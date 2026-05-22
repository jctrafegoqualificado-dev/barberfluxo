import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const now = new Date();

    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Tudo em paralelo (antes: 4 waves sequenciais com include gigante)
    const [shop, subscriptions, subAppointmentsByBarber, avulsosDoMes, inadimplentes, novasMes] = await Promise.all([
      prisma.barbershop.findUnique({
        where: { id: barbershopId },
        select: { poeOwnerPct: true, debitFee: true, creditFee: true, reminderMinutes: true, saasPlan: true },
      }),
      prisma.subscription.findMany({
        where: { barbershopId, status: "ACTIVE" },
        include: { plan: true },
      }),
      prisma.appointment.groupBy({
        by: ["barberId"],
        where: {
          barbershopId, status: "DONE", subscriptionId: { not: null },
          date: { gte: monthStart, lte: monthEnd },
        },
        _count: true,
      }),
      prisma.appointment.findMany({
        where: {
          barbershopId, status: "DONE", subscriptionId: null,
          date: { gte: monthStart, lte: monthEnd },
        },
        select: { price: true, paymentMethod: true },
      }),
      prisma.subscription.count({ where: { barbershopId, status: "OVERDUE" } }),
      prisma.subscription.count({
        where: { barbershopId, createdAt: { gte: monthStart, lte: monthEnd } },
      }),
    ]);

    const poeOwnerPct = shop?.poeOwnerPct ?? 50;
    const debitFee = shop?.debitFee ?? 0;
    const creditFee = shop?.creditFee ?? 0;
    const reminderMinutes = shop?.reminderMinutes ?? 60;
    const poeBarberPct = 100 - poeOwnerPct;

    // POE = soma de todos os planos ativos (MRR)
    const poeTotal = subscriptions.reduce((s, sub) => s + sub.plan.price, 0);
    const poeBarbearia = poeTotal * (poeOwnerPct / 100);
    const poolBarbeiros = poeTotal * (poeBarberPct / 100);

    const totalServicos = subAppointmentsByBarber.reduce((s, r) => s + r._count, 0);
    const ticketPorServico = totalServicos > 0 ? poolBarbeiros / totalServicos : 0;

    // Enriquece partilha por barbeiro com nome (1 query extra leve, em vez de join enorme)
    const barberIds = subAppointmentsByBarber.map((r) => r.barberId);
    const barbersInfo = barberIds.length > 0
      ? await prisma.barber.findMany({
          where: { id: { in: barberIds } },
          select: { id: true, user: { select: { name: true } } },
        })
      : [];
    const barberNameMap = new Map(barbersInfo.map((b) => [b.id, b.user.name]));
    const barberMap: Record<string, { name: string; servicos: number; recebe: number }> = {};
    for (const row of subAppointmentsByBarber) {
      barberMap[row.barberId] = {
        name: barberNameMap.get(row.barberId) || "Profissional",
        servicos: row._count,
        recebe: row._count * ticketPorServico,
      };
    }

    // Planos + utilização — 1 pass
    const planMap: Record<string, { name: string; price: number; assinantes: number; receita: number }> = {};
    let totalUsos = 0;
    let totalDisponivel = 0;
    for (const sub of subscriptions) {
      const pid = sub.plan.id;
      if (!planMap[pid]) planMap[pid] = { name: sub.plan.name, price: sub.plan.price, assinantes: 0, receita: 0 };
      planMap[pid].assinantes += 1;
      planMap[pid].receita += sub.plan.price;
      totalUsos += sub.usesThisCycle;
      totalDisponivel += sub.plan.maxUses || 0;
    }

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

    return NextResponse.json({
      poeOwnerPct,
      poeBarberPct,
      debitFee,
      creditFee,
      reminderMinutes,
      saasPlan: shop?.saasPlan ?? "BASIC",
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
    const { poeOwnerPct, debitFee, creditFee, reminderMinutes } = await req.json();
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
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
