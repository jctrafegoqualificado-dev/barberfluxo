import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import MercadoPago, { Payment } from "mercadopago";

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
    const paymentApi = new Payment(client);
    const mpPayment = await paymentApi.get({ id: paymentId });

    const barbershopId = mpPayment.external_reference;
    if (!barbershopId) return NextResponse.json({ ok: true });

    if (mpPayment.status === "approved") {
      // 1. Atualiza o plano da barbearia para PREMIUM
      await prisma.barbershop.update({
        where: { id: barbershopId },
        data: { saasPlan: "PREMIUM" },
      });

      // 2. Log de sucesso e auditoria do pagamento
      // (O registro na tabela Payment foi suspenso temporariamente pois a tabela Payment está atrelada à 'Subscription' do cliente final e não à 'Barbershop').
      console.log(`Pagamento MercadoPago [${paymentId}] concluído com sucesso.`);
      console.log(`✅ [SaaS Webhook] Plano PREMIUM liberado para barbearia: ${barbershopId}`);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("❌ [SaaS Webhook] Erro fatal:", e);
    return NextResponse.json({ ok: true }); // Sempre 200 para o MP parar de tentar
  }
}
