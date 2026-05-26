/**
 * GET /api/payments/mp-oauth/initiate
 *
 * Inicia o fluxo OAuth do Mercado Pago para conectar a conta de uma barbearia.
 * Gera um state JWT assinado (10 min) para prevenir CSRF e redireciona para
 * a tela de autorização do MP.
 *
 * O dono da barbearia clica "Conectar Mercado Pago" → chega aqui → vai pro MP
 * → autoriza → MP chama /callback com code + state.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import jwt from "jsonwebtoken";

const CLIENT_ID     = process.env.MP_APP_CLIENT_ID;
const REDIRECT_URI  = process.env.MP_OAUTH_REDIRECT_URI
  ?? "https://www.iadebarbearia.com.br/api/payments/mp-oauth/callback";
const BASE_URL      = process.env.NEXTAUTH_URL ?? "https://iadebarbearia.com.br";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);

    if (!CLIENT_ID) {
      console.error("[mp-oauth/initiate] MP_APP_CLIENT_ID não configurado");
      return NextResponse.redirect(
        `${BASE_URL}/painel/configuracoes/pagamentos?mp_oauth=error&reason=not_configured`,
      );
    }

    // State JWT: contém barbershopId + userId, expira em 10 min
    // Assinado com JWT_SECRET — o callback verifica antes de usar
    const state = jwt.sign(
      {
        barbershopId: payload.barbershopId,
        sub:          payload.id,
        // nonce aleatório evita reutilização do mesmo state
        nonce: Math.random().toString(36).slice(2),
      },
      process.env.JWT_SECRET!,
      { expiresIn: "10m" },
    );

    const authUrl = new URL("https://auth.mercadopago.com.br/authorization");
    authUrl.searchParams.set("client_id",     CLIENT_ID);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("platform_id",   "mp");
    authUrl.searchParams.set("redirect_uri",  REDIRECT_URI);
    authUrl.searchParams.set("state",         state);

    return NextResponse.redirect(authUrl.toString());
  } catch {
    return NextResponse.redirect(
      `${BASE_URL}/painel/configuracoes/pagamentos?mp_oauth=error&reason=unauthorized`,
    );
  }
}
