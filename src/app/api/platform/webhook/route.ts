import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import MercadoPago, { Payment, PreApproval } from "mercadopago";
import crypto from "crypto";

function verifySignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true; // Se não configurado, aceita (dev)

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature || !xRequestId) return false;

  // Formato: "ts=...,v1=..."
  const parts = Object.fromEntries(xSignature.split(",").map((p) => p.split("=")));
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${xRequestId};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return hmac === v1;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    // Valida assinatura (ignora em dev se secret não está configurado)
    if (!verifySignature(req, rawBody)) {
      console.warn("[platform/webhook] Assinatura inválida");
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const { type, data } = body;
    console.log("[platform/webhook] Evento recebido:", type, data?.id);

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ ok: true });
    }

    const mpClient = new MercadoPago({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

    // ─── Evento de PAGAMENTO (cobrança recorrente) ─────────────────────────────
    if (type === "payment" && data?.id) {
      const paymentApi = new Payment(mpClient);
      const mpPayment = await paymentApi.get({ id: data.id });

      const barbershopId = mpPayment.external_reference;
      if (!barbershopId) return NextResponse.json({ ok: true });

      const shop = await prisma.barbershop.findUnique({ where: { id: barbershopId } });
      if (!shop) return NextResponse.json({ ok: true });

      const status = mpPayment.status; // approved | pending | rejected | cancelled

      if (status === "approved") {
        // Registra o pagamento e ativa a barbearia
        await prisma.payment.create({
          data: {
            amount: mpPayment.transaction_amount ?? 0,
            method: mpPayment.payment_method_id?.includes("pix") ? "PIX" : "CREDIT_CARD",
            status: "PAID",
            externalId: String(data.id),
            paidAt: new Date(),
            barbershopId,
          },
        });

        await prisma.barbershop.update({
          where: { id: barbershopId },
          data: { active: true, saasStatus: "ACTIVE" },
        });

        console.log(`[platform/webhook] Pagamento aprovado para ${shop.name}`);
      } else if (status === "rejected" || status === "cancelled") {
        // Registra tentativa falha
        await prisma.payment.create({
          data: {
            amount: mpPayment.transaction_amount ?? 0,
            method: "CREDIT_CARD",
            status: "FAILED",
            externalId: String(data.id),
            barbershopId,
          },
        });

        await prisma.barbershop.update({
          where: { id: barbershopId },
          data: { saasStatus: "OVERDUE" },
        });

        console.log(`[platform/webhook] Pagamento ${status} para ${shop.name}`);
      }
    }

    // ─── Evento de ASSINATURA (mudança de status do preapproval) ──────────────
    if (type === "subscription_preapproval" && data?.id) {
      const preApprovalApi = new PreApproval(mpClient);
      const sub = await preApprovalApi.get({ id: data.id });

      const barbershopId = sub.external_reference;
      if (!barbershopId) return NextResponse.json({ ok: true });

      const subStatus = sub.status; // authorized | paused | cancelled | pending

      const saasStatus =
        subStatus === "authorized" ? "ACTIVE" :
        subStatus === "paused"     ? "PAUSED" :
        subStatus === "cancelled"  ? "CANCELLED" : "OVERDUE";

      const active = subStatus === "authorized";

      await prisma.barbershop.update({
        where: { id: barbershopId },
        data: {
          mpSubscriptionId: data.id,
          saasStatus,
          active,
        },
      });

      console.log(`[platform/webhook] Assinatura ${subStatus} para barbershopId=${barbershopId}`);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[platform/webhook] Erro:", e);
    // Sempre retorna 200 para o MP não reenviar infinitamente
    return NextResponse.json({ ok: true });
  }
}
