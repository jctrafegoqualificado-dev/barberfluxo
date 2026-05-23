import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import MercadoPago, { Payment as MPPayment } from "mercadopago";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const type = body.type || body.topic;
    const paymentId = body.data?.id || body.id;

    if (type !== "payment" || !paymentId || !process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ ok: true });
    }

    const client = new MercadoPago({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const paymentApi = new MPPayment(client);
    const mpPayment = await paymentApi.get({ id: paymentId });

    const externalRef = mpPayment.external_reference || "";
    if (!externalRef) return NextResponse.json({ ok: true });

    // Suporta dois formatos:
    // Novo:  "<barbershopId>|<plan>|<billingCycle>"
    // Legado: "<barbershopId>"
    const parts = externalRef.split("|");
    const barbershopId = parts[0];
    const planFromRef = parts[1] as "PRO" | "ELITE" | undefined;

    if (!barbershopId) return NextResponse.json({ ok: true });

    if (mpPayment.status === "approved") {
      // Determina o plano: prefere external_reference, fallback por valor (legado)
      let saasPlan: "PRO" | "ELITE" = "ELITE";
      if (planFromRef === "PRO" || planFromRef === "ELITE") {
        saasPlan = planFromRef;
      } else {
        const amount = Number(mpPayment.transaction_amount);
        if (amount <= 170) saasPlan = "PRO";
      }

      await prisma.barbershop.update({
        where: { id: barbershopId },
        data: { saasPlan },
      });

      await prisma.payment.create({
        data: {
          amount: Number(mpPayment.transaction_amount),
          method: mpPayment.payment_method_id === "pix" ? "PIX" : "CREDIT_CARD",
          status: "PAID",
          paidAt: new Date(),
          externalId: String(paymentId),
          barbershopId,
        },
      });

      console.log(`✅ [SaaS Webhook] Pagamento [${paymentId}] aprovado. Plano: ${saasPlan}. Barbearia: ${barbershopId}`);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("❌ [SaaS Webhook] Erro fatal:", e);
    return NextResponse.json({ ok: true }); // Sempre 200 para o MP parar de tentar
  }
}
