import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import MercadoPago, { Payment } from "mercadopago";

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const body = await req.json();
    
    // Dados vindos do Mercado Pago Brick
    const { token, issuer_id, payment_method_id, transaction_amount, installments, payer, planType } = body;

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ error: "Mercado Pago não configurado" }, { status: 500 });
    }

    const client = new MercadoPago({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const paymentApi = new Payment(client);

    // Busca dados do barbeiro no banco para completar o cadastro no Mercado Pago
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id }
    });

    // O Mercado Pago recusa "localhost" como URL de webhook. Em testes locais, usamos uma URL dummy.
    const baseUrl = process.env.NEXTAUTH_URL || "https://barberfluxo.vercel.app";
    const notificationUrl = baseUrl.includes("localhost") 
      ? "https://barberfluxo.vercel.app/api/payments/webhook-saas" 
      : `${baseUrl}/api/payments/webhook-saas`;

    // Refina os dados do pagador para garantir compatibilidade (especialmente PIX)
    const paymentData = {
      body: {
        token,
        issuer_id,
        payment_method_id,
        transaction_amount: Number(transaction_amount),
        installments: Number(installments) || 1,
        payer: {
          email: payer?.email || payload.email,
          // O Mercado Pago exige CPF válido (Mod 11) para PIX.
          identification: payer?.identification?.number 
            ? payer.identification 
            : { type: "CPF", number: "19119119100" }, // CPF Oficial de testes do MP
          first_name: payer?.first_name || dbUser?.name?.split(" ")[0] || "Dono",
          last_name: payer?.last_name || dbUser?.name?.split(" ").slice(1).join(" ") || "Barbearia",
        },
        external_reference: payload.barbershopId,
        notification_url: notificationUrl,
      },
    };

    const result = await paymentApi.create(paymentData);

    // Se o pagamento for aprovado instantaneamente (Cartão ou PIX já pago)
    if (result.status === "approved") {
      await prisma.barbershop.update({
        where: { id: payload.barbershopId! },
        data: { saasPlan: planType }, // Ex: PREMIUM
      });
    }

    return NextResponse.json({ 
      status: result.status, 
      status_detail: result.status_detail,
      id: result.id,
      qr_code: result.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64
    });

  } catch (e: any) {
    console.error("Erro MP SaaS:", e);
    // Tenta capturar a mensagem detalhada do Mercado Pago
    const mpError = e.api_response?.errors?.[0]?.message || e.message || "Erro ao processar pagamento";
    return NextResponse.json({ error: mpError, details: e.api_response?.errors }, { status: 500 });
  }
}
