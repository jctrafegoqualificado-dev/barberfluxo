import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const now = new Date();

    const shop = await prisma.barbershop.findUnique({ where: { id: barbershopId } });
    const poeOwnerPct = shop?.poeOwnerPct ?? 50;
    const debitFee = shop?.debitFee ?? 0;
    const creditFee = shop?.creditFee ?? 0;
    const reminderMinutes = shop?.reminderMinutes ?? 60;
    const cancelByClientEnabled = shop?.cancelByClientEnabled ?? true;
    const minCancelHours = shop?.minCancelHours ?? 0;
    const autoNoShowEnabled = shop?.autoNoShowEnabled ?? true;
    const autoNoShowHours = shop?.autoNoShowHours ?? 24;
    const discountServicesEnabled = shop?.discountServicesEnabled ?? false;
    const discountServicesMax = shop?.discountServicesMax ?? 20;
    const discountProductsEnabled = shop?.discountProductsEnabled ?? false;
    const discountProductsMax = shop?.discountProductsMax ?? 20;
    const poeBarberPct = 100 - poeOwnerPct;

    // Assinaturas ativas
    const subscriptions = await prisma.subscription.findMany({
      where: { barbershopId, status: "ACTIVE" },
      include: {
        plan: true,
        appointments: {
          where: {
            status: "DONE",
            subscriptionId: { not: null }, // apenas serviços de assinatura
            date: { gte: startOfMonth(now), lte: endOfMonth(now) },
          },
          include: {
            barber: {
              include: { user: { select: { name: true } } },
            },
            service: true,
          },
        },
      },
    });

    // POE = soma de todos os planos ativos (MRR)
    const poeTotal = subscriptions.reduce((s, sub) => s + sub.plan.price, 0);

    // Fatias do POE
    const poeBarbearia = poeTotal * (poeOwnerPct / 100);
    const poolBarbeiros = poeTotal * (poeBarberPct / 100);

    // Total de serviços realizados via assinatura no mês
    const allAppointments = subscriptions.flatMap((sub) => sub.appointments);
    const totalServicos = allAppointments.length;

    // Ticket médio por serviço (pool ÷ total serviços)
    const ticketPorServico = totalServicos > 0 ? poolBarbeiros / totalServicos : 0;

    // Partilha por barbeiro
    const barberMap: Record<string, { name: string; servicos: number; recebe: number }> = {};
    for (const appt of allAppointments) {
      const id = appt.barber.id;
      const name = appt.barber.user.name;
      if (!barberMap[id]) barberMap[id] = { name, servicos: 0, recebe: 0 };
      barberMap[id].servicos += 1;
      barberMap[id].recebe += ticketPorServico;
    }

    // Planos
    const planMap: Record<string, { name: string; price: number; assinantes: number; receita: number }> = {};
    for (const sub of subscriptions) {
      const pid = sub.plan.id;
      if (!planMap[pid]) planMap[pid] = { name: sub.plan.name, price: sub.plan.price, assinantes: 0, receita: 0 };
      planMap[pid].assinantes += 1;
      planMap[pid].receita += sub.plan.price;
    }

    // Utilização dos planos
    const totalUsos = subscriptions.reduce((s, sub) => s + sub.usesThisCycle, 0);
    const totalDisponivel = subscriptions.reduce((s, sub) => s + (sub.plan.maxUses || 0), 0);

    // Serviços avulsos do mês por forma de pagamento
    const avulsosDoMes = await prisma.appointment.findMany({
      where: {
        barbershopId,
        status: "DONE",
        subscriptionId: null,
        date: { gte: startOfMonth(now), lte: endOfMonth(now) },
      },
      select: { price: true, paymentMethod: true },
    });

    const avulsoByMethod: Record<string, { count: number; bruto: number; taxa: number; liquido: number }> = {};
    let avulsoBrutoTotal = 0;
    let avulsoLiquidoTotal = 0;

    for (const ap of avulsosDoMes) {
      const method = ap.paymentMethod ?? "CASH";
      const feeRate = method === "DEBIT" ? debitFee / 100 : method === "CREDIT" ? creditFee / 100 : 0;
      const taxa = ap.price * feeRate;
      if (!avulsoByMethod[method]) avulsoByMethod[method] = { count: 0, bruto: 0, taxa: 0, liquido: 0 };
      avulsoByMethod[method].count += 1;
      avulsoByMethod[method].bruto += ap.price;
      avulsoByMethod[method].taxa += taxa;
      avulsoByMethod[method].liquido += ap.price - taxa;
      avulsoBrutoTotal += ap.price;
      avulsoLiquidoTotal += ap.price - taxa;
    }

    // Inadimplentes e novas assinaturas
    const [inadimplentes, novasMes] = await Promise.all([
      prisma.subscription.count({ where: { barbershopId, status: "OVERDUE" } }),
      prisma.subscription.count({
        where: { barbershopId, createdAt: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      }),
    ]);

    return NextResponse.json({
      poeOwnerPct,
      poeBarberPct,
      debitFee,
      creditFee,
      reminderMinutes,
      cancelByClientEnabled,
      minCancelHours,
      autoNoShowEnabled,
      autoNoShowHours,
      discountServicesEnabled,
      discountServicesMax,
      discountProductsEnabled,
      discountProductsMax,
      saasPlan: shop?.saasPlan ?? "BASIC",
      trialEndsAt: shop?.trialEndsAt ? shop.trialEndsAt.toISOString() : null,
      avulso: {
        bruto: avulsoBrutoTotal,
        liquido: avulsoLiquidoTotal,
        taxaTotal: avulsoBrutoTotal - avulsoLiquidoTotal,
        byMethod: avulsoByMethod,
      },
      poeTotal,
      poeBarbearia,
      poolBarbeiros,
      ticketPorServico,
      totalServicos,
      totalAssinantes: subscriptions.length,
      taxaUtilizacao: totalDisponivel > 0 ? Math.round((totalUsos / totalDisponivel) * 100) : 0,
      inadimplentes,
      novasMes,
      partilhaBarbeiros: Object.entries(barberMap)
        .map(([id, b]) => ({ id, ...b }))
        .sort((a, b) => b.servicos - a.servicos),
      planos: Object.entries(planMap).map(([id, p]) => ({ id, ...p })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

// Atualiza o percentual do POE da barbearia
export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { poeOwnerPct, debitFee, creditFee, reminderMinutes, cancelByClientEnabled, minCancelHours, autoNoShowEnabled, autoNoShowHours, discountServicesEnabled, discountServicesMax, discountProductsEnabled, discountProductsMax } = await req.json();
    if (poeOwnerPct !== undefined && (poeOwnerPct < 0 || poeOwnerPct > 100)) {
      return NextResponse.json({ error: "Percentual inválido" }, { status: 400 });
    }
    await prisma.barbershop.update({
      where: { id: payload.barbershopId! },
      data: {
        ...(poeOwnerPct !== undefined ? { poeOwnerPct: Number(poeOwnerPct) } : {}),
        ...(debitFee !== undefined ? { debitFee: Number(debitFee) } : {}),
        ...(creditFee !== undefined ? { creditFee: Number(creditFee) } : {}),
        ...(reminderMinutes !== undefined ? { reminderMinutes: Number(reminderMinutes) } : {}),
        ...(cancelByClientEnabled !== undefined ? { cancelByClientEnabled: Boolean(cancelByClientEnabled) } : {}),
        ...(minCancelHours !== undefined ? { minCancelHours: Number(minCancelHours) } : {}),
        ...(autoNoShowEnabled !== undefined ? { autoNoShowEnabled: Boolean(autoNoShowEnabled) } : {}),
        ...(autoNoShowHours !== undefined ? { autoNoShowHours: Number(autoNoShowHours) } : {}),
        ...(discountServicesEnabled !== undefined ? { discountServicesEnabled: Boolean(discountServicesEnabled) } : {}),
        ...(discountServicesMax !== undefined ? { discountServicesMax: Math.min(100, Math.max(0, Number(discountServicesMax))) } : {}),
        ...(discountProductsEnabled !== undefined ? { discountProductsEnabled: Boolean(discountProductsEnabled) } : {}),
        ...(discountProductsMax !== undefined ? { discountProductsMax: Math.min(100, Math.max(0, Number(discountProductsMax))) } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
