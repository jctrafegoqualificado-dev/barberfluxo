/**
 * /api/barbershop/subscriptions/[id]/resume-authorization
 *
 * Retoma o débito automático via Mercado Pago de uma assinatura que foi pausada.
 *
 * Quando o dono dá baixa manual em uma assinatura com MP ativo, o débito é
 * pausado automaticamente (evita dupla cobrança). Este endpoint permite ao dono
 * reativar o débito automático quando quiser.
 *
 * POST → retoma o preapproval no MP (status → "authorized")
 * Retorna erro se:
 *  - Assinatura não pertence à barbearia
 *  - authorizationStatus não é "PAUSED" (não há o que retomar)
 *  - Gateway de pagamento não está configurado
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { decrypt } from "@/lib/encrypt";
import { resumeMpPreapproval } from "@/lib/mercadopago";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;

    const sub = await prisma.subscription.findFirst({
      where: { id, barbershopId },
      select: {
        id:                 true,
        authorizationStatus: true,
        mpPreapprovalId:    true,
      } as any,
    });

    if (!sub) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }

    const authStatus     = (sub as any).authorizationStatus as string;
    const mpPreapprovalId = (sub as any).mpPreapprovalId   as string | null;

    if (authStatus !== "PAUSED") {
      return NextResponse.json(
        { error: `Débito automático não está pausado (status atual: ${authStatus}).` },
        { status: 400 },
      );
    }

    if (!mpPreapprovalId) {
      return NextResponse.json(
        { error: "Assinatura sem preapproval MP vinculado." },
        { status: 400 },
      );
    }

    // Busca gateway da barbearia
    const gatewayConfig = await (prisma as any).paymentGatewayConfig.findUnique({
      where:  { barbershopId },
      select: { accessToken: true, active: true },
    });

    if (!gatewayConfig?.active) {
      return NextResponse.json(
        { error: "Gateway de pagamento não está configurado ou está inativo." },
        { status: 400 },
      );
    }

    // Retoma preapproval no MP
    const token = decrypt(gatewayConfig.accessToken);
    await resumeMpPreapproval(mpPreapprovalId, token);

    // Atualiza status no banco
    await prisma.subscription.update({
      where: { id },
      data:  { authorizationStatus: "AUTHORIZED" } as any,
    });

    void logAudit({
      barbershopId,
      userId:    payload.id,
      userEmail: payload.email,
      userRole:  payload.role,
      action:    "STATUS_CHANGE",
      entity:    "Subscription",
      entityId:  id,
      diff: {
        before: { authorizationStatus: "PAUSED" },
        after:  { authorizationStatus: "AUTHORIZED" },
      },
      ip: getClientIp(req),
    });

    return NextResponse.json({
      ok: true,
      message: "Débito automático retomado com sucesso. O Mercado Pago voltará a cobrar no próximo ciclo.",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
