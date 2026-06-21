import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getMonthlyPrice } from "@/lib/saasPlans";
import { loadSaasPlans } from "@/lib/saasPlans.server";
import MercadoPago, { PreApproval } from "mercadopago";

export async function POST(req: NextRequest) {
  try {
    requireAuth(req, ["PLATFORM_ADMIN"]);

    const { barbershopId } = await req.json();

    if (!barbershopId) {
      return NextResponse.json({ error: "barbershopId é obrigatório" }, { status: 400 });
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ error: "Mercado Pago não configurado" }, { status: 500 });
    }

    const shop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      include: { owner: { select: { name: true, email: true } } },
    });

    if (!shop) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const plans = await loadSaasPlans();
    const price = getMonthlyPrice(shop.saasPlan, plans) || 97;
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://iadebarbearia.com.br";

    const mpClient = new MercadoPago({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const preApprovalApi = new PreApproval(mpClient);

    const result = await preApprovalApi.create({
      body: {
        reason: `BarberApp ${shop.saasPlan} — ${shop.name}`,
        payer_email: shop.owner.email,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: price,
          currency_id: "BRL",
        },
        back_url: `${baseUrl}/plataforma/clientes/${barbershopId}?payment=success`,
        external_reference: barbershopId,
        status: "pending",
      },
    });

    // Salva o ID da assinatura MP na barbearia
    await prisma.barbershop.update({
      where: { id: barbershopId },
      data: { mpSubscriptionId: result.id },
    });

    return NextResponse.json({
      subscriptionId: result.id,
      checkoutUrl: result.init_point, // URL para o dono da barbearia autorizar
      plan: shop.saasPlan,
      price,
      shopName: shop.name,
      ownerEmail: shop.owner.email,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao criar assinatura";
    console.error("[platform/subscribe] Erro:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET — retorna status da assinatura atual de uma barbearia
export async function GET(req: NextRequest) {
  try {
    requireAuth(req, ["PLATFORM_ADMIN"]);

    const { searchParams } = new URL(req.url);
    const barbershopId = searchParams.get("barbershopId");

    if (!barbershopId) {
      return NextResponse.json({ error: "barbershopId é obrigatório" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: {
        id: true,
        name: true,
        saasPlan: true,
        saasStatus: true,
        mpSubscriptionId: true,
        active: true,
      },
    });

    if (!shop) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    // Se tiver ID no MP, busca status atualizado
    if (shop.mpSubscriptionId && process.env.MERCADOPAGO_ACCESS_TOKEN) {
      try {
        const mpClient = new MercadoPago({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
        const preApprovalApi = new PreApproval(mpClient);
        const mpSub = await preApprovalApi.get({ id: shop.mpSubscriptionId });

        return NextResponse.json({
          ...shop,
          mpStatus: mpSub.status,
          mpNextBilling: mpSub.next_payment_date,
        });
      } catch {
        // Falha ao buscar no MP — retorna dados do banco mesmo
      }
    }

    return NextResponse.json(shop);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
