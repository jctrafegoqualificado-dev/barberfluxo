import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import MercadoPago, { Payment } from "mercadopago";
import { createHmac, timingSafeEqual } from "crypto";
import { addMonths, addQuarters, addYears } from "date-fns";

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
 * String assinada:               "id:<paymentId>;request-id:<xRequestId>;ts:<ts>"
 *
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
function validateMpSignature(req: NextRequest, paymentId: string): boolean {
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
  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts}`;
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

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // MP envia notificações de vários tipos — só processa pagamentos
    if (body.type !== "payment") {
      return NextResponse.json({ ok: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId || !process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ ok: true });
    }

    // ── Validação de assinatura HMAC ──────────────────────────────────────────
    if (!validateMpSignature(req, String(paymentId))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // ── Busca detalhes do pagamento na API do MP ──────────────────────────────
    const client = new MercadoPago({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const paymentApi = new Payment(client);
    const mpPayment = await paymentApi.get({ id: paymentId });

    const subscriptionId = mpPayment.external_reference;
    if (!subscriptionId) return NextResponse.json({ ok: true });

    const status = mpPayment.status; // approved | pending | rejected | cancelled

    if (status === "approved") {
      // Busca assinatura + plano para avançar ciclo corretamente
      const sub = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: { select: { billingCycle: true } } },
      });

      // Marca o pagamento pendente como PAGO
      await prisma.payment.updateMany({
        where: { subscriptionId, status: "PENDING" },
        data: {
          status: "PAID",
          method: mpPayment.payment_method_id?.includes("pix") ? "PIX" : "CREDIT_CARD",
          externalId: String(paymentId),
          paidAt: new Date(),
        },
      });

      if (sub) {
        // Avança nextBillingDate para o próximo ciclo + reseta contagem de usos
        const nextBillingDate = advanceBillingDate(
          new Date(sub.nextBillingDate),
          (sub as { billingDay?: number | null }).billingDay ?? null,
          sub.plan.billingCycle,
        );

        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: "ACTIVE",
            nextBillingDate,
            usesThisCycle: 0,
          },
        });

        console.log(
          `[webhook] Pagamento aprovado — sub=${subscriptionId} próxima cobrança=${nextBillingDate.toISOString()}`,
        );
      }
    } else if (status === "rejected" || status === "cancelled") {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: "OVERDUE" },
      });

      console.log(`[webhook] Pagamento ${status} — sub=${subscriptionId} → OVERDUE`);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[webhook] Erro:", e);
    // Sempre retornar 200 para o MP não reenviar em loop
    return NextResponse.json({ ok: true });
  }
}
