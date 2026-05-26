/**
 * GET /api/payments/mp-oauth/callback
 *
 * Endpoint de callback do OAuth do Mercado Pago.
 * O MP redireciona aqui após o dono da barbearia autorizar a conexão.
 *
 * Fluxo:
 *  1. Valida o state JWT (previne CSRF)
 *  2. Troca o code pelo access_token via POST /oauth/token do MP
 *  3. Salva o token criptografado (AES-256-GCM) no PaymentGatewayConfig
 *  4. Redireciona para a página de pagamentos com ?mp_oauth=success
 *
 * SEGURANÇA:
 *  - state é JWT assinado com JWT_SECRET, expira em 10 min
 *  - accessToken é criptografado antes de persistir (nunca em texto claro no banco)
 *  - client_secret nunca é exposto ao cliente
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";
import { logAudit } from "@/lib/audit";
import jwt from "jsonwebtoken";

const CLIENT_ID    = process.env.MP_APP_CLIENT_ID!;
const CLIENT_SECRET = process.env.MP_APP_CLIENT_SECRET!;
const REDIRECT_URI = process.env.MP_OAUTH_REDIRECT_URI
  ?? "https://www.iadebarbearia.com.br/api/payments/mp-oauth/callback";
const BASE_URL     = process.env.NEXTAUTH_URL ?? "https://iadebarbearia.com.br";

const FAIL_URL    = `${BASE_URL}/painel/configuracoes/pagamentos?mp_oauth=error`;
const SUCCESS_URL = `${BASE_URL}/painel/configuracoes/pagamentos?mp_oauth=success`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // ── 1. Usuário cancelou a autorização no MP ───────────────────────────────
  if (error) {
    console.warn("[mp-oauth/callback] Usuário cancelou autorização:", error);
    return NextResponse.redirect(`${FAIL_URL}&reason=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${FAIL_URL}&reason=missing_params`);
  }

  // ── 2. Valida state JWT ───────────────────────────────────────────────────
  let statePayload: { barbershopId: string; sub: string };
  try {
    statePayload = jwt.verify(state, process.env.JWT_SECRET!) as {
      barbershopId: string;
      sub: string;
    };
  } catch {
    console.warn("[mp-oauth/callback] State JWT inválido ou expirado");
    return NextResponse.redirect(`${FAIL_URL}&reason=invalid_state`);
  }

  const { barbershopId, sub: userId } = statePayload;

  if (!barbershopId) {
    return NextResponse.redirect(`${FAIL_URL}&reason=missing_barbershop`);
  }

  // ── 3. Troca code por access_token ────────────────────────────────────────
  let accessToken: string;
  let mpUserId: string;
  let mpEmail  = "";

  try {
    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Accept:          "application/json",
      },
      body: JSON.stringify({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type:    "authorization_code",
        code,
        redirect_uri:  REDIRECT_URI,
      }),
      cache: "no-store",
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => "");
      console.error("[mp-oauth/callback] Falha ao trocar code:", tokenRes.status, errText);
      return NextResponse.redirect(`${FAIL_URL}&reason=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      user_id:      number | string;
    };

    accessToken = tokenData.access_token;
    mpUserId    = String(tokenData.user_id);

    if (!accessToken) {
      return NextResponse.redirect(`${FAIL_URL}&reason=no_access_token`);
    }

    // Busca e-mail do usuário MP para log de auditoria (best-effort)
    try {
      const meRes = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache:   "no-store",
      });
      if (meRes.ok) {
        const me = await meRes.json() as { email?: string };
        mpEmail = me.email ?? "";
      }
    } catch { /* ignora — log de audit é best-effort */ }

  } catch (err) {
    console.error("[mp-oauth/callback] Erro de rede ao trocar code:", err);
    return NextResponse.redirect(`${FAIL_URL}&reason=network_error`);
  }

  // ── 4. Salva criptografado no banco ───────────────────────────────────────
  try {
    const encryptedToken = encrypt(accessToken);

    const config = await (prisma as any).paymentGatewayConfig.upsert({
      where:  { barbershopId },
      create: {
        barbershopId,
        gateway:     "mercadopago",
        accessToken: encryptedToken,
        mpUserId,
        active:      true,
      },
      update: {
        gateway:     "mercadopago",
        accessToken: encryptedToken,
        mpUserId,
        active:      true,
      },
      select: { id: true },
    });

    void logAudit({
      barbershopId,
      userId,
      userEmail: mpEmail,
      userRole:  "OWNER",
      action:    "UPDATE",
      entity:    "PaymentGatewayConfig",
      entityId:  config.id,
      diff: {
        after: {
          gateway:  "mercadopago",
          mpUserId,
          method:   "oauth",  // distingue de conexão manual
        },
      },
      ip: req.headers.get("x-forwarded-for") ?? "unknown",
    });

  } catch (err) {
    console.error("[mp-oauth/callback] Erro ao salvar no banco:", err);
    return NextResponse.redirect(`${FAIL_URL}&reason=db_error`);
  }

  // ── 5. Sucesso — redireciona de volta para a página de pagamentos ─────────
  return NextResponse.redirect(SUCCESS_URL);
}
