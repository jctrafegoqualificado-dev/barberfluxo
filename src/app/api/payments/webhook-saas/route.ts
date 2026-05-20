import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import MercadoPago, { Payment as MPPayment } from "mercadopago";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Mercado Pago envia notificações de vários tipos e formatos
    const type = body.type || body.topic;
    const paymentId = body.data?.id || body.id;

    if (type !== "payment" || !paymentId || !process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ ok: true });
    }

    const client = new MercadoPago({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const paymentApi = new MPPayment(client);
    const mpPayment = await paymentApi.get({ id: paymentId });

    const barbershopId = mpPayment.external_reference;
    if (!barbershopId) return NextResponse.json({ ok: true });

    if (mpPayment.status === "approved") {
      // 1. Atualiza o plano da barbearia para PREMIUM
      await prisma.barbershop.update({
        where: { id: barbershopId },
        data: { saasPlan: "PREMIUM" },
      });

      // 2. Salva o pagamento automatizado na tabela de Faturamento SaaS
      await prisma.payment.create({
        data: {
          amount: Number(mpPayment.transaction_amount),
          method: mpPayment.payment_method_id === "pix" ? "PIX" : "CREDIT_CARD",
          status: "PAID",
          paidAt: new Date(),
          externalId: String(paymentId),
          barbershopId: barbershopId
        }
      });

      console.log(`✅ [SaaS Webhook] Pagamento automatizado MercadoPago [${paymentId}] salvo com sucesso. Barbearia: ${barbershopId}`);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("❌ [SaaS Webhook] Erro fatal:", e);
    return NextResponse.json({ ok: true }); // Sempre 200 para o MP parar de tentar
  }
}
