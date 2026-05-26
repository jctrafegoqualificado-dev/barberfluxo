/**
 * /api/payments/preapproval
 *
 * POST — Cria um Preapproval no Mercado Pago para uma Subscription existente.
 *         Retorna o link de checkout (initPoint) que o OWNER envia ao cliente
 *         para que ele autorize o débito automático recorrente.
 *
 * DELETE — Cancela o Preapproval no MP (ex.: assinante solicitou cancelamento).
 *
 * Fluxo após autorização do cliente:
 *   1. Cliente autoriza → MP começa a cobrar automaticamente.
 *   2. MP chama POST /api/payments/webhook com type="subscription_authorized_payment".
 *   3. O webhook avança nextBillingDate e marca o pagamento como PAGO.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createMpPreapproval, cancelMpPreapproval } from "@/lib/mercadopago";
import { decrypt } from "@/lib/encrypt";

// ─── POST /api/payments/preapproval ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { subscriptionId } = await req.json();

    if (!subscriptionId) {
      return NextResponse.json({ error: "subscriptionId obrigatório" }, { status: 400 });
    }

    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId, barbershopId },
      include: {
        client:    { select: { email: true, name: true } },
        plan:      { select: { name: true, price: true, billingCycle: true } },
        barbershop:{ select: { name: true } },
      },
    });

    if (!sub) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }

    if (sub.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Não é possível criar cobrança recorrente para assinatura cancelada" },
        { status: 400 },
      );
    }

    // Idempotente: se já foi criado, apenas informa o ID (não gera novo link)
    if ((sub as any).mpPreapprovalId) {
      return NextResponse.json({
        preapprovalId: (sub as any).mpPreapprovalId,
        alreadyExists: true,
        message: "Preapproval já criado. Compartilhe o link anterior ou cancele e recrie.",
      });
    }

    // ── Busca token MP da barbearia (obrigatório) ─────────────────────────────
    const gatewayConfig = await (prisma as any).paymentGatewayConfig.findUnique({
      where:  { barbershopId, active: true },
      select: { accessToken: true },
    });

    if (!gatewayConfig?.accessToken) {
      return NextResponse.json(
        { error: "Mercado Pago não conectado. Configure em Configurações → Pagamentos." },
        { status: 400 },
      );
    }

    const barbershopToken = decrypt(gatewayConfig.accessToken);
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    const { preapprovalId, initPoint } = await createMpPreapproval({
      subscriptionId,
      reason:            `${sub.plan.name} — ${sub.barbershop.name}`,
      payerEmail:        sub.client.email,
      transactionAmount: sub.plan.price,
      billingCycle:      sub.plan.billingCycle,
      startDate:         new Date(sub.nextBillingDate),
      backUrl:           `${baseUrl}/painel/assinaturas?preapproval=success`,
      // barbershopId no webhook para identificar qual token usar ao processar
      notificationUrl:   `${baseUrl}/api/payments/webhook?barbershopId=${barbershopId}`,
    }, barbershopToken);

    // Persiste o ID para rastreamento futuro
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { mpPreapprovalId: preapprovalId } as any,
    });

    console.log(
      `[preapproval] Criado: sub=${subscriptionId} preapproval=${preapprovalId}`,
    );

    return NextResponse.json({ preapprovalId, checkoutUrl: initPoint }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao criar cobrança recorrente";
    console.error("[preapproval] POST:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── DELETE /api/payments/preapproval?subscriptionId=... ─────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { searchParams } = new URL(req.url);
    const subscriptionId = searchParams.get("subscriptionId");

    if (!subscriptionId) {
      return NextResponse.json({ error: "subscriptionId obrigatório" }, { status: 400 });
    }

    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId, barbershopId: payload.barbershopId! },
      select: { mpPreapprovalId: true } as any,
    });

    if (!sub) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }

    const mpId = (sub as any).mpPreapprovalId as string | null;

    if (mpId) {
      // Busca token da barbearia para cancelar no contexto correto
      const gatewayConfig = await (prisma as any).paymentGatewayConfig.findUnique({
        where:  { barbershopId: payload.barbershopId!, active: true },
        select: { accessToken: true },
      });
      const barbershopToken = gatewayConfig?.accessToken
        ? decrypt(gatewayConfig.accessToken)
        : undefined;

      await cancelMpPreapproval(mpId, barbershopToken);

      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { mpPreapprovalId: null } as any,
      });

      console.log(`[preapproval] Cancelado: sub=${subscriptionId} preapproval=${mpId}`);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao cancelar cobrança recorrente";
    console.error("[preapproval] DELETE:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
