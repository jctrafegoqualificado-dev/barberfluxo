/**
 * /api/barbershop/payment-config
 *
 * Gerencia as credenciais do gateway de pagamento de cada barbearia.
 * Cada barbearia conecta sua própria conta (ex: Mercado Pago) para cobrar
 * clientes diretamente. A plataforma NÃO intermedia nem recebe nenhuma %.
 *
 * SEGURANÇA:
 *  - accessToken NUNCA é retornado em nenhuma resposta
 *  - accessToken é validado no MP antes de ser salvo
 *  - accessToken é salvo criptografado (AES-256-GCM)
 *  - Apenas OWNER pode gerenciar
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/encrypt";
import { logAudit, getClientIp } from "@/lib/audit";

// ─── Helper: valida token no MP chamando /users/me ────────────────────────────

interface MpUserInfo {
  id: number;
  email: string;
  site_id: string;
}

async function validateMpToken(accessToken: string): Promise<MpUserInfo> {
  const res = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    throw new Error("Token do Mercado Pago inválido ou expirado");
  }
  if (!res.ok) {
    throw new Error(`Erro ao validar token no Mercado Pago (HTTP ${res.status})`);
  }

  return res.json() as Promise<MpUserInfo>;
}

// ─── GET — retorna status da conexão (NUNCA devolve o accessToken) ────────────

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const config = await (prisma as any).paymentGatewayConfig.findUnique({
      where: { barbershopId },
      select: {
        id:        true,
        gateway:   true,
        publicKey: true,
        mpUserId:  true,
        active:    true,
        createdAt: true,
        updatedAt: true,
        // accessToken: NÃO incluir — nunca expor
      },
    });

    if (!config) {
      return NextResponse.json({ connected: false, config: null });
    }

    return NextResponse.json({ connected: true, config });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── POST — salva/atualiza credenciais (valida antes de salvar) ───────────────

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { gateway = "mercadopago", accessToken, publicKey } = await req.json();

    if (!accessToken?.trim()) {
      return NextResponse.json({ error: "Access Token é obrigatório" }, { status: 400 });
    }
    if (gateway !== "mercadopago") {
      return NextResponse.json({ error: "Gateway não suportado ainda" }, { status: 400 });
    }

    // 1. Valida o token no MP antes de salvar qualquer coisa
    let mpUser: MpUserInfo;
    try {
      mpUser = await validateMpToken(accessToken.trim());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Token inválido";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 2. Criptografa o token antes de persistir
    const encryptedToken = encrypt(accessToken.trim());

    // 3. Upsert — cria ou atualiza (barbearia pode reconectar)
    const config = await (prisma as any).paymentGatewayConfig.upsert({
      where:  { barbershopId },
      create: {
        barbershopId,
        gateway,
        accessToken: encryptedToken,
        publicKey:   publicKey?.trim() || null,
        mpUserId:    String(mpUser.id),
        active:      true,
      },
      update: {
        gateway,
        accessToken: encryptedToken,
        publicKey:   publicKey?.trim() || null,
        mpUserId:    String(mpUser.id),
        active:      true,
      },
      select: {
        id:        true,
        gateway:   true,
        publicKey: true,
        mpUserId:  true,
        active:    true,
        updatedAt: true,
        // accessToken: NÃO retornar
      },
    });

    // 4. Audit
    void logAudit({
      barbershopId,
      userId:    payload.id,
      userEmail: payload.email,
      userRole:  payload.role,
      action:    "UPDATE",
      entity:    "PaymentGatewayConfig",
      entityId:  config.id,
      diff: { after: { gateway, mpUserId: String(mpUser.id) } },
      ip: getClientIp(req),
    });

    return NextResponse.json({
      connected: true,
      config,
      message: `Mercado Pago conectado com sucesso (conta: ${mpUser.email})`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── DELETE — desconecta o gateway ────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const existing = await (prisma as any).paymentGatewayConfig.findUnique({
      where: { barbershopId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Nenhum gateway configurado" }, { status: 404 });
    }

    // Avisa sobre assinaturas com débito automático ativo
    const authorizedSubs = await prisma.subscription.count({
      where: {
        barbershopId,
        authorizationStatus: "AUTHORIZED",
        status: "ACTIVE",
      } as any,
    });

    // Desconecta
    await (prisma as any).paymentGatewayConfig.delete({
      where: { barbershopId },
    });

    // Audit
    void logAudit({
      barbershopId,
      userId:    payload.id,
      userEmail: payload.email,
      userRole:  payload.role,
      action:    "DELETE",
      entity:    "PaymentGatewayConfig",
      entityId:  existing.id,
      ip: getClientIp(req),
    });

    return NextResponse.json({
      connected: false,
      warning: authorizedSubs > 0
        ? `Atenção: ${authorizedSubs} assinatura(s) com débito automático ativo no Mercado Pago. Os clientes ainda serão cobrados pelo MP, mas o sistema não receberá mais as confirmações automáticas.`
        : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
