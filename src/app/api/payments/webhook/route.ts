/**
 * /api/payments/webhook
 *
 * Recebe notificações do Mercado Pago e processa dois tipos de evento:
 *
 *  1. type="payment"
 *     Pagamento avulso (Preference/checkout único).
 *     external_reference = subscriptionId no banco.
 *
 *  2. type="subscription_authorized_payment"
 *     Cobrança automática de um Preapproval (débito recorrente).
 *     data.id = authorized_payment_id → preapproval_id → mpPreapprovalId no banco.
 *
 * Segurança: toda requisição é validada por HMAC-SHA256 antes de processar.
 * O endpoint sempre retorna HTTP 200 (mesmo em erro) para evitar loop de retentativas do MP.
 *
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import MercadoPago, { Payment } from "mercadopago";
import { createHmac, timingSafeEqual } from "crypto";
import { addMonths, addQuarters, addYears } from "date-fns";
import { getMpAuthorizedPayment } from "@/lib/mercadopago";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampDay(day: number, year: number, month: number): number {
  return Math.min(day, new Date(year, month + 1, 0).getDate());
}

/**
 * Avança a data de vencimento conforme o ciclo do plano.
 * Respeita billingDay fixo (ex: sempre dia 10) ajustando para o mês destino.
 */
function advanceBillingDate(
  current: Date,
  billingDay: number | null,
  billingCycle: string,
): Date {
  let next: Date;
  switch (billingCycle) {
    case "QUARTERLY":
      next = addQuarters(current, 1);
      break;
    case "YEARLY":
      next = addYears(current, 1);
      break;
    default: // MONTHLY
      next = addMonths(current, 1);
  }

  if (!billingDay) return next;
  return new Date(
    next.getFullYear(),
    next.getMonth(),
    clampDay(billingDay, next.getFullYear(), next.getMonth()),
  );
}

/**
 * Valida a assinatura HMAC-SHA256 enviada pelo Mercado Pago.
 *
 * Formato do header x-signature: "ts=<epoch>,v1=<hex>"
 * String assinada:               "id:<dataId>;request-id:<xRequestId>;ts:<ts>"
 *
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
function validateMpSignature(req: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[webhook] MERCADOPAGO_WEBHOOK_SECRET não configurado — requisição bloqueada");
    return false;
  }

  const rawSignature = req.headers.get("x-signature");
  const requestId    = req.headers.get("x-request-id") ?? "";

  // Em desenvolvimento sem assinatura (curl local, sandbox sem HMAC), permite
  // passagem mas loga aviso. Em produção, bloqueia sempre.
  if (!rawSignature) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[webhook] x-signature ausente — permitido apenas em desenvolvimento");
      return true;
    }
    console.warn("[webhook] x-signature ausente em produção — requisição rejeitada");
    return false;
  }

  // Parse "ts=<timestamp>,v1=<hash>"
  const parts: Record<string, string> = {};
  for (const part of rawSignature.split(",")) {
    const idx = part.indexOf("=");
    if (idx > 0) parts[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }

  const { ts, v1 } = parts;
  if (!ts || !v1) {
    console.warn("[webhook] x-signature malformado");
    return false;
  }

  // Computa HMAC esperado
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts}`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  // Comparação em tempo constante (previne timing attacks)
  try {
    return (
      expected.length === v1.length &&
      timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(v1, "utf8"))
    );
  } catch {
    return false;
  }
}

// ─── Helpers de persistência ─────────────────────────────────────────────────

/**
 * Marca pagamentos pendentes como PAGO e avança o ciclo da assinatura.
 * Usado tanto por pagamentos avulsos (Preference) quanto por débito automático (Preapproval).
 */
async function markPaidAndAdvance(
  subscriptionId: string,
  paymentMethodId: string,
  externalId: string,
) {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: { select: { billingCycle: true } } },
  });

  if (!sub) {
    console.warn(`[webhook] Subscription ${subscriptionId} não encontrada`);
    return;
  }

  await prisma.payment.updateMany({
    where: { subscriptionId, status: "PENDING" },
    data: {
      status:     "PAID",
      method:     paymentMethodId.includes("pix") ? "PIX" : "CREDIT_CARD",
      externalId: externalId,
      paidAt:     new Date(),
    },
  });

  const nextBillingDate = advanceBillingDate(
    new Date(sub.nextBillingDate),
    (sub as { billingDay?: number | null }).billingDay ?? null,
    sub.plan.billingCycle,
  );

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: "ACTIVE", nextBillingDate, usesThisCycle: 0 },
  });

  console.log(
    `[webhook] Pagamento aprovado — sub=${subscriptionId} próxima cobrança=${nextBillingDate.toISOString()}`,
  );
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body as { type: string; data?: { id: string } };

    const dataId = data?.id ? String(data.id) : null;

    // Ignora tipos que não processamos
    if (type !== "payment" && type !== "subscription_authorized_payment") {
      return NextResponse.json({ ok: true });
    }

    if (!dataId || !process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ ok: true });
    }

    // ── Validação de assinatura HMAC (mesma lógica para ambos os tipos) ───────
    if (!validateMpSignature(req, dataId)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // ── Tipo 1: Pagamento avulso (Preference) ─────────────────────────────────
    if (type === "payment") {
      const client = new MercadoPago({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
      const paymentApi = new Payment(client);
      const mpPayment = await paymentApi.get({ id: dataId });

      const subscriptionId = mpPayment.external_reference;
      if (!subscriptionId) return NextResponse.json({ ok: true });

      const status = mpPayment.status; // approved | pending | rejected | cancelled

      if (status === "approved") {
        await markPaidAndAdvance(
          subscriptionId,
          mpPayment.payment_method_id ?? "",
          dataId,
        );
      } else if (status === "rejected" || status === "cancelled") {
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: { status: "OVERDUE" },
        });
        console.log(`[webhook] Pagamento ${status} — sub=${subscriptionId} → OVERDUE`);
      }

      return NextResponse.json({ ok: true });
    }

    // ── Tipo 2: Débito automático (Preapproval) ───────────────────────────────
    if (type === "subscription_authorized_payment") {
      const authPayment = await getMpAuthorizedPayment(dataId);

      // Localiza a Subscription pelo mpPreapprovalId
      const sub = await prisma.subscription.findFirst({
        where: { mpPreapprovalId: authPayment.preapproval_id } as any,
        select: { id: true },
      });

      if (!sub) {
        console.warn(
          `[webhook] Preapproval ${authPayment.preapproval_id} não encontrado em nenhuma Subscription`,
        );
        return NextResponse.json({ ok: true });
      }

      if (authPayment.status === "processed") {
        // Cria registro do pagamento recorrente se não houver PENDING
        const pendingExists = await prisma.payment.findFirst({
          where: { subscriptionId: sub.id, status: "PENDING" },
        });

        if (!pendingExists) {
          await prisma.payment.create({
            data: {
              subscriptionId: sub.id,
              amount: authPayment.transaction_amount,
              method: "CREDIT_CARD", // preapproval só aceita cartão/conta MP
              status: "PENDING",
            },
          });
        }

        await markPaidAndAdvance(
          sub.id,
          authPayment.payment_method_id ?? "credit_card",
          dataId,
        );
      } else if (authPayment.status === "cancelled") {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "OVERDUE" },
        });
        console.log(
          `[webhook] Débito automático cancelado — sub=${sub.id} preapproval=${authPayment.preapproval_id} → OVERDUE`,
        );
      } else {
        // "recycling" = MP vai tentar novamente — não altera status
        console.log(
          `[webhook] Débito automático em reciclagem — sub=${sub.id} status=${authPayment.status}`,
        );
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[webhook] Erro:", e);
    // Sempre retornar 200 para o MP não reenviar em loop
    return NextResponse.json({ ok: true });
  }
}
