import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfMonth, endOfMonth, parseISO, differenceInDays } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const now = new Date();

    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const from = fromParam ? parseISO(fromParam) : startOfMonth(now);
    const to = toParam ? parseISO(toParam) : endOfMonth(now);

    // ── Round 1: todas as queries independentes em paralelo ──────────────────
    const [subscriptions, newSubsPeriod, billingLogs, appts, latestVisitGroups, shop] = await Promise.all([
      prisma.subscription.findMany({
        where: { barbershopId },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          plan: true,
        },
      }),
      prisma.subscription.count({ where: { barbershopId, createdAt: { gte: from, lte: to } } }),
      prisma.payment.findMany({
        where: { subscription: { barbershopId }, createdAt: { gte: from, lte: to } },
        include: {
          subscription: {
            include: {
              client: { select: { name: true, email: true } },
              plan: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", date: { gte: from, lte: to } },
        include: {
          service: true,
          barber: { include: { user: { select: { name: true } } } },
          client: { select: { id: true, name: true } },
        },
      }),
      // Substituído findMany (sem filtro de data, full table scan) por groupBy
      // que retorna apenas a data máxima por cliente — muito mais eficiente
      prisma.appointment.groupBy({
        by: ["clientId"],
        where: { barbershopId, status: "DONE" },
        _max: { date: true },
      }),
      prisma.barbershop.findUnique({ where: { id: barbershopId } }),
    ]);

    // ── Derivações em memória a partir de subscriptions ───────────────────────
    const activeSubs = subscriptions.filter((s) => s.status === "ACTIVE");
    const overdueSubs = subscriptions.filter((s) => s.status === "OVERDUE");
    const cancelledSubs = subscriptions.filter((s) => s.status === "CANCELLED");
    const mrr = activeSubs.reduce((acc, s) => acc + s.plan.price, 0);

    const planCounts: Record<string, { name: string; price: number; count: number; total: number }> = {};
    for (const sub of activeSubs) {
      const pid = sub.planId;
      if (!planCounts[pid]) planCounts[pid] = { name: sub.plan.name, price: sub.plan.price, count: 0, total: 0 };
      planCounts[pid].count += 1;
      planCounts[pid].total += sub.plan.price;
    }
    const planosBreakdown = Object.values(planCounts);

    const formattedBilling = billingLogs.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      status: p.status,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      clientName: p.subscription?.client.name ?? "Cliente avulso",
      planName: p.subscription?.plan.name ?? "Plano Geral",
    }));

    const totalActiveAndOverdue = activeSubs.length + overdueSubs.length;
    const adimplenciaRate = totalActiveAndOverdue > 0
      ? Math.round((activeSubs.length / totalActiveAndOverdue) * 100)
      : 100;

    // ── Derivações em memória a partir de appts ───────────────────────────────
    const totalServices = appts.length;
    const servicesRevenue = appts.reduce((sum, a) => sum + a.price, 0);
    const uniqueClientsPeriod = new Set(appts.map((a) => a.clientId));
    const avgTicketServices = uniqueClientsPeriod.size > 0 ? servicesRevenue / uniqueClientsPeriod.size : 0;

    const serviceRankingMap: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const a of appts) {
      if (!a.service) continue;
      const sname = a.service.name;
      if (!serviceRankingMap[sname]) serviceRankingMap[sname] = { name: sname, count: 0, revenue: 0 };
      serviceRankingMap[sname].count += 1;
      serviceRankingMap[sname].revenue += a.price;
    }
    const serviceRanking = Object.values(serviceRankingMap).sort((a, b) => b.count - a.count);

    const barberPerformanceMap: Record<string, { name: string; nickname: string | null; count: number; gross: number; commission: number }> = {};
    for (const a of appts) {
      const bid = a.barberId;
      if (!barberPerformanceMap[bid]) {
        barberPerformanceMap[bid] = { name: a.barber.user.name, nickname: a.barber.nickname, count: 0, gross: 0, commission: 0 };
      }
      const commPct = a.barber.commission ?? 50;
      const commVal = a.barber.commissionType === "PERCENTAGE" ? (a.price * (commPct / 100)) : a.barber.commission;
      barberPerformanceMap[bid].count += 1;
      barberPerformanceMap[bid].gross += a.price;
      barberPerformanceMap[bid].commission += commVal;
    }
    const barberPerformance = Object.values(barberPerformanceMap).sort((a, b) => b.gross - a.gross);

    const clientSpentMap: Record<string, { name: string; email: string; phone: string | null; visits: number; totalSpent: number }> = {};
    for (const a of appts) {
      const cid = a.clientId;
      if (!clientSpentMap[cid]) clientSpentMap[cid] = { name: a.client.name, email: "", phone: null, visits: 0, totalSpent: 0 };
      clientSpentMap[cid].visits += 1;
      clientSpentMap[cid].totalSpent += a.price;
    }

    const periodClientIds = [...new Set(appts.map((a) => a.clientId))];

    // ── Round 2: queries que dependem dos resultados do round 1 ──────────────
    const latestVisitByClient: Record<string, Date> = {};
    for (const g of latestVisitGroups) {
      if (g._max.date) latestVisitByClient[g.clientId] = new Date(g._max.date);
    }
    const clientsWithVisits = Object.keys(latestVisitByClient);

    const [clientsData, earliestApptsByClient, fullClientsInfo] = await Promise.all([
      periodClientIds.length > 0
        ? prisma.user.findMany({ where: { id: { in: periodClientIds } }, select: { id: true, email: true, phone: true } })
        : Promise.resolve([] as Array<{ id: string; email: string; phone: string | null }>),
      periodClientIds.length > 0
        ? prisma.appointment.groupBy({
            by: ["clientId"],
            where: { barbershopId, status: "DONE", clientId: { in: periodClientIds } },
            _min: { date: true },
          })
        : Promise.resolve([] as Array<{ clientId: string; _min: { date: Date | null } }>),
      clientsWithVisits.length > 0
        ? prisma.user.findMany({ where: { id: { in: clientsWithVisits } }, select: { id: true, name: true, email: true, phone: true } })
        : Promise.resolve([] as Array<{ id: string; name: string; email: string; phone: string | null }>),
    ]);

    for (const u of clientsData) {
      if (clientSpentMap[u.id]) {
        clientSpentMap[u.id].email = u.email;
        clientSpentMap[u.id].phone = u.phone;
      }
    }

    const clientRanking = Object.values(clientSpentMap).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 15);

    let newCount = 0;
    let recurrentCount = 0;
    for (const item of earliestApptsByClient) {
      const minDate = item._min.date;
      if (minDate && minDate >= from && minDate <= to) newCount += 1;
      else recurrentCount += 1;
    }

    const riskClients: Array<{ id: string; name: string; email: string; phone: string | null; lastVisit: Date; daysSince: number }> = [];
    for (const c of fullClientsInfo) {
      const lvisit = latestVisitByClient[c.id];
      if (!lvisit) continue;
      const diff = differenceInDays(now, lvisit);
      if (diff > 45) riskClients.push({ id: c.id, name: c.name, email: c.email, phone: c.phone, lastVisit: lvisit, daysSince: diff });
    }
    riskClients.sort((a, b) => b.daysSince - a.daysSince);

    // ==========================================
    // 3. MODELO POE (Subscription Pool)
    // ==========================================
    const poeOwnerPct = shop?.poeOwnerPct ?? 50;
    const poeBarberPct = 100 - poeOwnerPct;
    const debitFee = shop?.debitFee ?? 0;
    const creditFee = shop?.creditFee ?? 0;
    const poeDeductFees = shop?.poeDeductFees ?? false;
    const poeSubscriptionFee = shop?.poeSubscriptionFee ?? 0;

    const poeGrossTotal = mrr;
    const poeTaxas = poeDeductFees ? poeGrossTotal * (poeSubscriptionFee / 100) : 0;
    const poeTotal = poeGrossTotal - poeTaxas;
    const poeBarbearia = poeTotal * (poeOwnerPct / 100);
    const poolBarbeiros = poeTotal * (poeBarberPct / 100);

    const poeAppts = appts.filter(a => a.subscriptionId !== null);
    const totalServicosPoe = poeAppts.length;
    const ticketPorServicoPoe = totalServicosPoe > 0 ? poolBarbeiros / totalServicosPoe : 0;

    const partilhaMap: Record<string, { name: string; servicos: number; recebe: number }> = {};
    for (const appt of poeAppts) {
      const id = appt.barberId;
      const name = appt.barber.user.name;
      if (!partilhaMap[id]) partilhaMap[id] = { name, servicos: 0, recebe: 0 };
      partilhaMap[id].servicos += 1;
      partilhaMap[id].recebe += ticketPorServicoPoe;
    }
    const partilhaBarbeiros = Object.entries(partilhaMap)
      .map(([id, b]) => ({ id, ...b }))
      .sort((a, b) => b.servicos - a.servicos);

    // ==========================================
    // 4. NET REVENUE (Atendimentos Líquido)
    // ==========================================
    const safeDebitFee = typeof debitFee === "number" && !isNaN(debitFee) ? debitFee : 0;
    const safeCreditFee = typeof creditFee === "number" && !isNaN(creditFee) ? creditFee : 0;
    let netRevenue = 0;
    for (const a of appts) {
      const method = a.paymentMethod ?? "CASH";
      const feeRate = method === "DEBIT" || method === "DEBIT_CARD" ? safeDebitFee / 100
        : method === "CREDIT" || method === "CREDIT_CARD" ? safeCreditFee / 100 : 0;
      netRevenue += a.price - (a.price * feeRate);
    }

    return NextResponse.json({
      range: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      },
      subscriptions: {
        mrr,
        active: activeSubs.length,
        overdue: overdueSubs.length,
        cancelled: cancelledSubs.length,
        total: subscriptions.length,
        growth: newSubsPeriod,
        adimplenciaRate,
        planosBreakdown,
        billingLogs: formattedBilling,
        poe: {
          poeOwnerPct,
          poeBarberPct,
          poeDeductFees,
          poeSubscriptionFee,
          poeGrossTotal,
          poeTaxas,
          poeTotal,
          poeBarbearia,
          poolBarbeiros,
          ticketPorServico: ticketPorServicoPoe,
          totalServicos: totalServicosPoe,
          partilhaBarbeiros,
        },
      },
      atendimentos: {
        totalServices,
        revenue: servicesRevenue,
        netRevenue,
        avgTicket: avgTicketServices,
        serviceRanking,
        barberPerformance,
        debitFee,
        creditFee,
      },
      clientes: {
        ranking: clientRanking,
        cohort: {
          new: newCount,
          recurrent: recurrentCount,
        },
        riskList: riskClients.slice(0, 30),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
