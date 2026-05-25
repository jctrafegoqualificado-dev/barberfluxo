import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";
import { addMonths } from "date-fns";
import { sendSubscriptionConfirmation } from "@/lib/email";
import { subscriptionCreateRatelimit } from "@/lib/ratelimit";
import { logAudit, getClientIp } from "@/lib/audit";
import { decrypt } from "@/lib/encrypt";
import { createMpPreapproval } from "@/lib/mercadopago";
import { sendWhatsAppNotification } from "@/lib/notifications";

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
      select: {
        id: true,
        status: true,
        startDate: true,
        nextBillingDate: true,
        billingDay: true,
        usesThisCycle: true,
        beneficiaries: true,
        createdAt: true,
        client: { select: { id: true, name: true, email: true, phone: true } },
        plan: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            billingCycle: true,
            maxUses: true,
            beneficiaryRules: true,
            active: true,
            commissionPercentage: true,
            planServices: {
              select: {
                id: true,
                quantity: true,
                service: { select: { id: true, name: true, price: true, duration: true } },
              },
            },
            allowedBarbers: { select: { id: true, userId: true } },
          },
        },
        payments: {
          select: { id: true, amount: true, method: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const res = NextResponse.json({ subscriptions });
    res.headers.set("Cache-Control", "private, no-cache");
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);

    // Rate limiting — 30 criações por barbearia a cada 15 minutos
    const key = `barbershop:${payload.barbershopId ?? "unknown"}`;
    const { success } = await subscriptionCreateRatelimit.limit(key);
    if (!success) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde alguns minutos." },
        { status: 429 },
      );
    }

    const { clientName, clientPhone, planId, billingDay } = await req.json();
    const billingDayNum = billingDay ? Number(billingDay) : null;

    if (!planId) return NextResponse.json({ error: "Selecione um plano" }, { status: 400 });
    if (!clientPhone) return NextResponse.json({ error: "WhatsApp obrigatório" }, { status: 400 });

    // Valida que o plano pertence a esta barbearia (CVE-10)
    const plan = await prisma.plan.findFirst({ where: { id: planId, barbershopId: payload.barbershopId! } });
    if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });

    const barbershop = await prisma.barbershop.findUnique({
      where: { id: payload.barbershopId! },
      select: { name: true },
    });

    // Verifica se a barbearia tem gateway de pagamento configurado (MP multi-tenant)
    const gatewayConfig = await (prisma as any).paymentGatewayConfig.findUnique({
      where:  { barbershopId: payload.barbershopId! },
      select: { accessToken: true, active: true },
    });
    const hasGateway = Boolean(gatewayConfig?.active);

    const cleanPhone = clientPhone.replace(/\D/g, "") || "sem-telefone";

    // Busca direta por telefone — evita full table scan
    const clientEmail = `${cleanPhone}@cliente.barberfluxo.com`;
    let client = await prisma.user.findFirst({
      where: { phone: cleanPhone, role: "CLIENT" },
    });

    if (!client) {
      client = await prisma.user.findUnique({ where: { email: clientEmail } });
    }

    if (!client) {
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

    const subscription = await prisma.$transaction(async (tx) => {
      return tx.subscription.create({
        data: {
          clientId: client.id,
          planId,
          barbershopId: payload.barbershopId!,
          nextBillingDate: nextBilling,
          billingDay: billingDayNum,
          beneficiaries,
          // Modo MANUAL: cria cobrança pendente imediatamente (dono dá baixa depois)
          // Modo GATEWAY: sem cobrança pendente — o MP cria via webhook quando confirmar
          ...(!hasGateway && {
            payments: {
              create: { amount: plan.price, method: "PIX", status: "PENDING" },
            },
          }),
          // authorizationStatus padrão "MANUAL" no schema — gateway sobrescreve abaixo
        },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          plan: true,
        },
      });
    });

    // ── Audit: criação de assinatura ──
    void logAudit({
      barbershopId: payload.barbershopId!,
      userId:    payload.id,
      userEmail: payload.email,
      userRole:  payload.role,
      action:    "CREATE",
      entity:    "Subscription",
      entityId:  subscription.id,
      diff: {
        after: {
          clientId:   client.id,
          clientName: client.name,
          planId,
          planName:   plan.name,
          price:      plan.price,
          billingDay: billingDayNum,
        },
      },
      ip: getClientIp(req),
    });

    // ── Integração MP: cria preapproval e envia link de autorização ──────────
    // Feito APÓS commit da transação — se falhar, a assinatura já existe (MANUAL)
    // e o dono pode reenviar o link manualmente via /send-authorization
    if (hasGateway && gatewayConfig) {
      try {
        const decryptedToken = decrypt(gatewayConfig.accessToken);
        const baseUrl = process.env.NEXTAUTH_URL ?? "https://iadebarbearia.com.br";
        const backUrl = `${baseUrl}/assinatura-confirmada?id=${subscription.id}`;

        const { preapprovalId, initPoint } = await createMpPreapproval(
          {
            subscriptionId:    subscription.id,
            reason:            `${plan.name} — ${barbershop?.name ?? "Barbearia"}`,
            payerEmail:        client.email,
            transactionAmount: plan.price,
            billingCycle:      plan.billingCycle,
            startDate:         nextBilling,
            backUrl,
          },
          decryptedToken,
        );

        // Salva preapprovalId + link + status no banco
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            mpPreapprovalId:    preapprovalId,
            authorizationLink:   initPoint,
            authorizationStatus: "PENDING_AUTH",
            authorizationSentAt: new Date(),
          },
        });

        // Envia link via WhatsApp — fire-and-forget
        if (client.phone) {
          void sendWhatsAppNotification(
            payload.barbershopId!,
            client.phone,
            `🎉 *Bem-vindo ao plano ${plan.name}!*\n\n` +
            `Olá, ${client.name}! Sua assinatura na *${barbershop?.name ?? "barbearia"}* foi criada.\n\n` +
            `Para ativar o débito automático via Mercado Pago, clique no link abaixo:\n\n` +
            `👉 ${initPoint}\n\n` +
            `_Após autorizar, as cobranças serão feitas automaticamente a cada ciclo. ✅_`,
          );
        }

        // Retorna a subscription já com os dados do MP
        const updatedSub = { ...subscription, mpPreapprovalId: preapprovalId, authorizationLink: initPoint, authorizationStatus: "PENDING_AUTH" };
        void logAudit({
          barbershopId: payload.barbershopId!,
          userId:    payload.id,
          userEmail: payload.email,
          userRole:  payload.role,
          action:    "UPDATE",
          entity:    "Subscription",
          entityId:  subscription.id,
          diff: { after: { mpPreapprovalId: preapprovalId, authorizationStatus: "PENDING_AUTH" } },
          ip: getClientIp(req),
        });

        // E-mail também
        sendSubscriptionConfirmation({
          to: client.email,
          clientName: client.name,
          shopName: barbershop?.name ?? "Barbearia",
          planName: plan.name,
          price: plan.price,
          nextBilling,
        }).catch(() => {});

        return NextResponse.json({ subscription: updatedSub }, { status: 201 });
      } catch (mpErr) {
        // Falha na integração MP → não cancela a assinatura; dono resolve manualmente
        console.error("[subscriptions] Falha ao criar preapproval MP:", mpErr);
        // Continua para retornar a subscription criada (sem link MP)
      }
    }

    // E-mail é fire-and-forget — falha não reverte a assinatura criada
    sendSubscriptionConfirmation({
      to: client.email,
      clientName: client.name,
      shopName: barbershop?.name ?? "Barbearia",
      planName: plan.name,
      price: plan.price,
      nextBilling,
    }).catch((err) => {
      console.error(`[subscriptions] E-mail de confirmação falhou para ${client.email}:`, err);
    });

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
