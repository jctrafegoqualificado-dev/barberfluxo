import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";
import { addMonths } from "date-fns";
import { sendSubscriptionConfirmation } from "@/lib/email";

function clampDay(day: number, year: number, month: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(day, daysInMonth);
}

function initialBillingDate(billingDay: number | null): Date {
  if (!billingDay) return addMonths(new Date(), 1);
  const now = new Date();
  const thisMonthDay = clampDay(billingDay, now.getFullYear(), now.getMonth());
  const candidate = new Date(now.getFullYear(), now.getMonth(), thisMonthDay);
  if (candidate > now) return candidate;
  const next = addMonths(now, 1);
  return new Date(next.getFullYear(), next.getMonth(), clampDay(billingDay, next.getFullYear(), next.getMonth()));
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    const where: any = { barbershopId: payload.barbershopId! };
    if (phone) {
      where.client = { phone: { contains: phone.replace(/\D/g, "") } };
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        plan: {
          include: {
            planServices: {
              include: { service: true }
            },
            allowedBarbers: true,
          }
        },
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
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const { clientName, clientPhone, planId, billingDay } = await req.json();
    const billingDayNum = billingDay ? Number(billingDay) : null;

    if (!planId) return NextResponse.json({ error: "Selecione um plano" }, { status: 400 });
    if (!clientPhone) return NextResponse.json({ error: "WhatsApp obrigatório" }, { status: 400 });

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });

    const barbershop = await prisma.barbershop.findUnique({
      where: { id: payload.barbershopId! },
      select: { name: true },
    });

    const cleanPhone = clientPhone.replace(/\D/g, "") || "sem-telefone";

    // Sprint 1: Busca por telefone sanitizado (evita duplicidade)
    const allClients = await prisma.user.findMany({ where: { role: "CLIENT" } });
    let client = allClients.find(c => c.phone?.replace(/\D/g, "") === cleanPhone) || null;

    if (!client) {
      const clientEmail = `${cleanPhone}@cliente.barberfluxo.com`;
      // Verifica se o email já existe (fallback)
      client = await prisma.user.findUnique({ where: { email: clientEmail } });
    }

    if (!client) {
      const clientEmail = `${cleanPhone}@cliente.barberfluxo.com`;
      const hashed = await hashPassword(clientPhone);
      client = await prisma.user.create({
        data: { name: clientName, email: clientEmail, phone: cleanPhone, password: hashed, role: "CLIENT" },
      });
    }

    const existing = await prisma.subscription.findFirst({
      where: { clientId: client.id, barbershopId: payload.barbershopId!, status: "ACTIVE" },
    });
    if (existing) {
      return NextResponse.json({ error: "Cliente já possui assinatura ativa" }, { status: 400 });
    }

    const nextBilling = initialBillingDate(billingDayNum);

    // Inicializa beneficiários se o plano possuir regras para dependentes
    const beneficiaries = Array.isArray(plan.beneficiaryRules)
      ? plan.beneficiaryRules.map((r: any) => ({ name: r.name, maxUses: r.maxUses, uses: 0 }))
      : undefined;

    const subscription = await prisma.subscription.create({
      data: {
        clientId: client.id,
        planId,
        barbershopId: payload.barbershopId!,
        nextBillingDate: nextBilling,
        billingDay: billingDayNum,
        beneficiaries,
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

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const { subscriptionId, beneficiaryName } = await req.json();

    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId, barbershopId: payload.barbershopId! },
    });

    if (!sub) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    let updatedBeneficiaries = sub.beneficiaries;
    if (beneficiaryName && Array.isArray(sub.beneficiaries)) {
      const beneficiaries = sub.beneficiaries as any[];
      const bIndex = beneficiaries.findIndex(b => b.name === beneficiaryName);
      
      if (bIndex === -1) return NextResponse.json({ error: "Beneficiário não encontrado" }, { status: 404 });
      
      if (beneficiaries[bIndex].uses >= beneficiaries[bIndex].maxUses) {
        return NextResponse.json({ error: `Limite de uso atingido para ${beneficiaryName}` }, { status: 400 });
      }

      updatedBeneficiaries = beneficiaries.map((b, i) => 
        i === bIndex ? { ...b, uses: b.uses + 1 } : b
      );
    }

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        usesThisCycle: sub.usesThisCycle + 1,
        beneficiaries: updatedBeneficiaries || undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
