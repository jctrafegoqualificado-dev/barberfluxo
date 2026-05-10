import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import MercadoPago, { Preference } from "mercadopago";

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { subscriptionId } = await req.json();

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ error: "Mercado Pago não configurado" }, { status: 500 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId, barbershopId: payload.barbershopId! },
      include: {
        client: { select: { name: true, email: true } },
        plan: true,
        barbershop: { select: { name: true } },
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }

    const client = new MercadoPago({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const preference = new Preference(client);

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    const result = await preference.create({
      body: {
        items: [
          {
            id: subscription.planId,
            title: `${subscription.plan.name} — ${subscription.barbershop.name}`,
            unit_price: subscription.plan.price,
            quantity: 1,
            currency_id: "BRL",
          },
        ],
        payer: {
          name: subscription.client.name,
          email: subscription.client.email,
        },
        back_urls: {
          success: `${baseUrl}/painel/assinaturas?payment=success`,
          failure: `${baseUrl}/painel/assinaturas?payment=failure`,
          pending: `${baseUrl}/painel/assinaturas?payment=pending`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/payments/webhook`,
        external_reference: subscriptionId,
        payment_methods: {
          installments: 1,
        },
      },
    });

    return NextResponse.json({ paymentUrl: result.init_point, sandboxUrl: result.sandbox_init_point });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao criar cobrança";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
