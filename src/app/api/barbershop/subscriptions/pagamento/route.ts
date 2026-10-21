import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { decrypt } from "@/lib/encrypt";
import { pauseMpPreapproval } from "@/lib/mercadopago";
import { advanceDue } from "@/lib/subscriptionCycle";
import { logAudit, getClientIp } from "@/lib/audit";
import { settleSubscriptionPayment } from "@/lib/subscriptionPayments";

// Formas aceitas na baixa manual (DEBIT/CREDIT: telas antigas)
const METHODS = ["PIX", "CASH", "DEBIT_CARD", "CREDIT_CARD", "DEBIT", "CREDIT"];

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type SubForPayment = {
  id: string; nextBillingDate: Date; billingDay: number | null;
  plan: { price: number; billingCycle: string };
};

/**
 * Dá baixa na cobrança pendente (ou registra uma paga) e anda o vencimento 1 ciclo do plano
 * (mensal 1 mês, trimestral 3, anual 12). Zera os usos do ciclo.
 */
async function processSinglePayment(tx: Tx, barbershopId: string, sub: SubForPayment, method: string) {
  // Clique duplo: a mesma baixa enviada duas vezes em poucos segundos não paga dois ciclos
  const justPaid = await tx.payment.findFirst({
    where: { subscriptionId: sub.id, status: "PAID", paidAt: { gte: new Date(Date.now() - 10_000) } },
    select: { id: true },
  });
  if (justPaid) return;

  await settleSubscriptionPayment(tx, { subscriptionId: sub.id, barbershopId, amount: sub.plan.price, method });

  await tx.subscription.update({
    where: { id: sub.id },
    data: {
      nextBillingDate: advanceDue(sub.nextBillingDate, sub.billingDay, sub.plan.billingCycle),
      usesThisCycle: 0,
      status: "ACTIVE",
    },
  });
}

/**
 * Débito automático ativo + baixa manual = o Mercado Pago cobraria de novo o mesmo ciclo.
 * Pausa o débito antes (o dono decide depois se retoma).
 */
async function pauseAutoDebit(barbershopId: string, sub: { id: string; authorizationStatus: string; mpPreapprovalId: string | null }) {
  if (sub.authorizationStatus !== "AUTHORIZED" || !sub.mpPreapprovalId) return;
  try {
    const gatewayConfig = await prisma.paymentGatewayConfig.findUnique({
      where: { barbershopId },
      select: { accessToken: true, active: true },
    });
    if (!gatewayConfig?.active) return;
    await pauseMpPreapproval(sub.mpPreapprovalId, decrypt(gatewayConfig.accessToken));
    await prisma.subscription.update({ where: { id: sub.id }, data: { authorizationStatus: "PAUSED" } });
  } catch (mpErr) {
    // Falha no MP não impede o registro manual — apenas loga
    console.error("[pagamento] Falha ao pausar preapproval MP:", mpErr);
  }
}

const SUB_SELECT = {
  id: true, nextBillingDate: true, billingDay: true, authorizationStatus: true, mpPreapprovalId: true,
  plan: { select: { price: true, billingCycle: true } },
} as const;

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();
    const method = METHODS.includes(body.method) ? body.method : null;
    if (!method) return NextResponse.json({ error: "Escolha a forma de pagamento" }, { status: 400 });

    // Lote: { ids: string[], method } — Single: { subscriptionId, method }
    const ids: string[] = Array.isArray(body.ids) ? body.ids : body.subscriptionId ? [body.subscriptionId] : [];
    if (!ids.length) return NextResponse.json({ error: "Nenhuma assinatura informada" }, { status: 400 });

    const subs = await prisma.subscription.findMany({ where: { id: { in: ids }, barbershopId }, select: SUB_SELECT });
    if (subs.length === 0) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    for (const sub of subs) await pauseAutoDebit(barbershopId, sub);

    await prisma.$transaction(async (tx) => {
      for (const sub of subs) await processSinglePayment(tx, barbershopId, sub, method);
    });

    void logAudit({
      barbershopId, userId: payload.id, userEmail: payload.email, userRole: payload.role,
      action: "MANUAL_PAYMENT", entity: "Subscription", entityId: subs.length === 1 ? subs[0].id : "lote",
      diff: { after: { ids: subs.map((s) => s.id), method } },
      ip: getClientIp(req),
    });

    return NextResponse.json({ ok: true, processed: subs.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

/** Desfaz a última baixa: apaga o pagamento e volta o vencimento 1 ciclo. Só o dono. */
export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const subscriptionId = new URL(req.url).searchParams.get("subscriptionId");
    if (!subscriptionId) return NextResponse.json({ error: "Assinatura não fornecida" }, { status: 400 });

    const sub = await prisma.subscription.findFirst({
      where: { id: subscriptionId, barbershopId },
      select: { ...SUB_SELECT, payments: { where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 1, select: { id: true, amount: true } } },
    });
    if (!sub) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    const latestPayment = sub.payments[0];
    if (!latestPayment) return NextResponse.json({ error: "Nenhum pagamento confirmado para desfazer" }, { status: 400 });

    await prisma.$transaction([
      prisma.payment.delete({ where: { id: latestPayment.id } }),
      prisma.subscription.update({
        where: { id: subscriptionId },
        data: { nextBillingDate: advanceDue(sub.nextBillingDate, sub.billingDay, sub.plan.billingCycle, -1) },
      }),
    ]);

    void logAudit({
      barbershopId, userId: payload.id, userEmail: payload.email, userRole: payload.role,
      action: "PAYMENT_UNDO", entity: "Subscription", entityId: subscriptionId,
      diff: { before: { paymentId: latestPayment.id, amount: latestPayment.amount } },
      ip: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao desfazer pagamento";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
