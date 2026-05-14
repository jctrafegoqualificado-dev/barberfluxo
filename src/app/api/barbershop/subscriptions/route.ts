import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";
import { addMonths } from "date-fns";
import { sendSubscriptionConfirmation } from "@/lib/email";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const subscriptions = await prisma.subscription.findMany({
      where: { barbershopId: payload.barbershopId! },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        plan: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ subscriptions });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { clientName, clientPhone, planId } = await req.json();

    if (!planId) return NextResponse.json({ error: "Selecione um plano" }, { status: 400 });
    if (!clientPhone) return NextResponse.json({ error: "WhatsApp obrigatório" }, { status: 400 });

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });

    const barbershop = await prisma.barbershop.findUnique({
      where: { id: payload.barbershopId! },
      select: { name: true },
    });

    const cleanPhone = clientPhone.replace(/\D/g, "") || "sem-telefone";
    const clientEmail = `${cleanPhone}@cliente.barberfluxo`;

    let client = await prisma.user.findUnique({ where: { email: clientEmail } });
    if (!client) {
      const hashed = await hashPassword(clientPhone);
      client = await prisma.user.create({
        data: { name: clientName, email: clientEmail, phone: clientPhone, password: hashed, role: "CLIENT" },
      });
    }

    const existing = await prisma.subscription.findFirst({
      where: { clientId: client.id, barbershopId: payload.barbershopId!, status: "ACTIVE" },
    });
    if (existing) {
      return NextResponse.json({ error: "Cliente já possui assinatura ativa" }, { status: 400 });
    }

    const nextBilling = addMonths(new Date(), 1);

    const subscription = await prisma.subscription.create({
      data: {
        clientId: client.id,
        planId,
        barbershopId: payload.barbershopId!,
        nextBillingDate: nextBilling,
        payments: {
          create: { amount: plan.price, method: "PIX", status: "PENDING" },
        },
      },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        plan: true,
      },
    });

    // Envia email de confirmação ao cliente
    sendSubscriptionConfirmation({
      to: client.email,
      clientName: client.name,
      shopName: barbershop?.name ?? "Barbearia",
      planName: plan.name,
      price: plan.price,
      nextBilling,
    }).catch(console.error);

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
