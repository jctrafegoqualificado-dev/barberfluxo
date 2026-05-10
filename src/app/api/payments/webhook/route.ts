import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import MercadoPago, { Payment } from "mercadopago";

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

    const client = new MercadoPago({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const paymentApi = new Payment(client);
    const mpPayment = await paymentApi.get({ id: paymentId });

    const subscriptionId = mpPayment.external_reference;
    if (!subscriptionId) return NextResponse.json({ ok: true });

    const status = mpPayment.status; // approved | pending | rejected

    if (status === "approved") {
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

      // Garante que a assinatura está ACTIVE
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: "ACTIVE" },
      });
    } else if (status === "rejected") {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: "OVERDUE" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Webhook MP error:", e);
    return NextResponse.json({ ok: true }); // sempre retornar 200 para MP não reenviar
  }
}
