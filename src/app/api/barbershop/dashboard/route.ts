import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  startOfDay, endOfDay, startOfMonth, endOfMonth,
  subDays, getDaysInMonth, getDate, format,
  differenceInDays
} from "date-fns";

/**
 * Dashboard BI — Multi-Period API
 *
 * Supports: ?period=today|7d|30d|month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const now = new Date();

    // --- Parse period filter ---
    const period = req.nextUrl.searchParams.get("period") || "month";
    const customFrom = req.nextUrl.searchParams.get("from");
    const customTo = req.nextUrl.searchParams.get("to");

    let periodStart: Date;
    let periodEnd: Date;

    switch (period) {
      case "today":
        periodStart = startOfDay(now);
        periodEnd = endOfDay(now);
        break;
      case "7d":
        periodStart = startOfDay(subDays(now, 6));
        periodEnd = endOfDay(now);
        break;
      case "30d":
        periodStart = startOfDay(subDays(now, 29));
        periodEnd = endOfDay(now);
        break;
      case "custom":
        periodStart = customFrom ? startOfDay(new Date(customFrom)) : startOfMonth(now);
        periodEnd = customTo ? endOfDay(new Date(customTo)) : endOfDay(now);
        break;
      case "month":
      default:
        periodStart = startOfMonth(now);
        periodEnd = endOfMonth(now);
        break;
    }

    const periodDays = differenceInDays(periodEnd, periodStart) + 1;
    const prevPeriodEnd = new Date(periodStart.getTime() - 1);
    const prevPeriodStart = startOfDay(subDays(periodStart, periodDays));

    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthKey = format(now, "yyyy-MM");
    const currentMonth = now.getMonth() + 1;

    // --- PHASE A: fetch what we need to derive IDs/aggregates from ---
    const [todayAppointments, periodAllAppointments] = await Promise.all([
      prisma.appointment.findMany({
        where: { barbershopId, date: { gte: todayStart, lte: todayEnd } },
        include: {
          client: { select: { name: true, phone: true } },
          barber: { include: { user: { select: { name: true } } } },
          service: { select: { name: true, duration: true, price: true } },
          subscription: { include: { plan: { select: { name: true } } } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.appointment.findMany({
        where: { barbershopId, date: { gte: periodStart, lte: periodEnd } },
        select: { price: true, clientId: true, barberId: true, date: true, status: true, service: { select: { duration: true } } },
        orderBy: { date: "asc" }
      })
    ]);

    // In-memory derivations from Phase A — single pass over doneAppointmentsInPeriod
    const barberRevenueMap: Record<string, { revenue: number; count: number }> = {};
    const clientSpentMap: Record<string, { spent: number; count: number }> = {};
    const periodClientSet = new Set<string>();
    let periodRevenue = 0;

    // dailyRevenueMap initialized here so it's filled in the same pass
    const dailyRevenueMap = new Map<string, number>();
    for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
      dailyRevenueMap.set(format(d, "dd/MM"), 0);
    }

    for (const a of periodAllAppointments) {
      if (a.status !== "DONE") continue;
      if (!barberRevenueMap[a.barberId]) barberRevenueMap[a.barberId] = { revenue: 0, count: 0 };
      barberRevenueMap[a.barberId].revenue += a.price;
      barberRevenueMap[a.barberId].count += 1;

      if (!clientSpentMap[a.clientId]) clientSpentMap[a.clientId] = { spent: 0, count: 0 };
      clientSpentMap[a.clientId].spent += a.price;
      clientSpentMap[a.clientId].count += 1;

      periodClientSet.add(a.clientId);
      periodRevenue += a.price;

      const dateStr = format(a.date, "dd/MM");
      const prev = dailyRevenueMap.get(dateStr);
      if (prev !== undefined) dailyRevenueMap.set(dateStr, prev + a.price);
    }

    const doneAppointmentsInPeriod = periodAllAppointments.filter((a) => a.status === "DONE");
    const periodClientIds = Array.from(periodClientSet);

    const topBarbersRaw = Object.entries(barberRevenueMap)
      .map(([barberId, data]) => ({ barberId, _sum: { price: data.revenue }, _count: data.count }))
      .sort((a, b) => (b._sum.price || 0) - (a._sum.price || 0))
      .slice(0, 5);
    const topBarberIds = topBarbersRaw.map((b) => b.barberId);

    const topClientsRaw = Object.entries(clientSpentMap)
      .map(([clientId, data]) => ({ clientId, _sum: { price: data.spent }, _count: data.count }))
      .sort((a, b) => (b._sum.price || 0) - (a._sum.price || 0))
      .slice(0, 5);
    const topClientIds = topClientsRaw.map((c) => c.clientId);

    // --- PHASE B: everything else in one parallel wave ---
    const [
      prevPeriodDoneAggregates,
      prevPeriodDistinctClientsGroups,
      periodProductSales,
      activeSubscriptions,
      activeBarbers,
      commissionPayments,
      commissionVales,
      whatsappInstance,
      openingHours,
      periodReviews,
      prevPeriodReviews,
      birthdaysThisMonthRaw,
      clientsBeforePeriod,
      barberUsers,
      clientUsers,
    ] = await Promise.all([
      prisma.appointment.aggregate({
        where: { barbershopId, status: "DONE", date: { gte: prevPeriodStart, lte: prevPeriodEnd } },
        _sum: { price: true },
        _count: { _all: true }
      }),
      prisma.appointment.groupBy({
        by: ["clientId"],
        where: { barbershopId, status: "DONE", date: { gte: prevPeriodStart, lte: prevPeriodEnd } },
        _count: true,
      }),
      prisma.productSale.aggregate({
        where: { barbershopId, createdAt: { gte: periodStart, lte: periodEnd } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.subscription.findMany({
        where: { barbershopId, status: "ACTIVE" },
        include: { plan: { select: { price: true } } },
      }),
      prisma.barber.count({ where: { barbershopId, active: true } }),
      prisma.commissionPayment.findMany({ where: { barbershopId, month: monthKey } }),
      prisma.commissionVale.findMany({ where: { barbershopId, month: monthKey } }),
      prisma.whatsAppInstance.findUnique({
        where: { barbershopId },
        select: { status: true, lastConnectedAt: true },
      }),
      prisma.openingHour.findMany({
        where: { barbershopId, isOpen: true },
        select: { dayOfWeek: true, openTime: true, closeTime: true },
      }),
      prisma.review.findMany({ where: { barbershopId, createdAt: { gte: periodStart, lte: periodEnd } } }),
      prisma.review.findMany({ where: { barbershopId, createdAt: { gte: prevPeriodStart, lte: prevPeriodEnd } } }),
      prisma.$queryRaw<Array<{ id: string; name: string; phone: string | null; day: number }>>`
        SELECT u.id, u.name, u.phone, EXTRACT(DAY FROM u.birthday)::int AS day
        FROM "User" u
        WHERE u.birthday IS NOT NULL
          AND EXTRACT(MONTH FROM u.birthday) = ${currentMonth}
          AND EXISTS (
            SELECT 1 FROM "Appointment" a
            WHERE a."clientId" = u.id AND a."barbershopId" = ${barbershopId}
          )
        ORDER BY day ASC
      `,
      periodClientIds.length > 0
        ? prisma.appointment.groupBy({
            by: ["clientId"],
            where: {
              barbershopId, status: "DONE", date: { lt: periodStart },
              clientId: { in: periodClientIds },
            },
            _count: true,
          })
        : Promise.resolve([] as Array<{ clientId: string }>),
      topBarberIds.length > 0
        ? prisma.barber.findMany({
            where: { id: { in: topBarberIds } },
            include: { user: { select: { name: true } } },
          })
        : Promise.resolve([] as Array<{ id: string; user: { name: string } }>),
      topClientIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: topClientIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([] as Array<{ id: string; name: string }>),
    ]);

    // --- PHASE C: in-memory calculations + response ---

    const dailyRevenue = Array.from(dailyRevenueMap, ([date, revenue]) => ({ date, revenue }));

    // Single pass over periodAllAppointments for status counts + used minutes
    const appointmentStatusCounts = { DONE: 0, PENDING: 0, CANCELLED: 0, NO_SHOW: 0 };
    let totalUsedMinutes = 0;
    for (const a of periodAllAppointments) {
      if (a.status === "DONE") { appointmentStatusCounts.DONE++; totalUsedMinutes += (a as { service?: { duration: number } | null }).service?.duration ?? 30; }
      else if (a.status === "PENDING" || a.status === "CONFIRMED") { appointmentStatusCounts.PENDING++; totalUsedMinutes += (a as { service?: { duration: number } | null }).service?.duration ?? 30; }
      else if (a.status === "CANCELLED") appointmentStatusCounts.CANCELLED++;
      else if (a.status === "NO_SHOW") appointmentStatusCounts.NO_SHOW++;
    }

    // Aniversariantes — já filtrados por mês no banco, só normaliza shape
    const birthdaysThisMonth = birthdaysThisMonthRaw.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      day: c.day,
    }));

    // Gauge de Ocupação
    const totalAvailableMinutes = (() => {
      let mins = 0;
      for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        const oh = openingHours.find((h) => h.dayOfWeek === dow);
        if (!oh) continue;
        const [openH, openM] = oh.openTime.split(":").map(Number);
        const [closeH, closeM] = oh.closeTime.split(":").map(Number);
        mins += ((closeH * 60 + closeM) - (openH * 60 + openM));
      }
      return mins * Math.max(1, activeBarbers);
    })();
    const occupationPct = totalAvailableMinutes > 0
      ? Math.min(100, Math.round((totalUsedMinutes / totalAvailableMinutes) * 100))
      : 0;
    const occupationStatus = occupationPct >= 80 ? "SOBRECARGA" : occupationPct >= 50 ? "IDEAL" : "BAIXA";

    // KPIs
    const prevPeriodRevenue = prevPeriodDoneAggregates._sum.price || 0;
    const revenueChange = prevPeriodRevenue > 0
      ? Math.round(((periodRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100)
      : null;

    const periodAppointments = doneAppointmentsInPeriod.length;
    const prevPeriodAppointments = prevPeriodDoneAggregates._count._all || 0;
    const appointmentsChange = prevPeriodAppointments > 0
      ? Math.round(((periodAppointments - prevPeriodAppointments) / prevPeriodAppointments) * 100)
      : null;

    const ticketMedio = periodAppointments > 0 ? periodRevenue / periodAppointments : 0;
    const prevTicketMedio = prevPeriodAppointments > 0 ? prevPeriodRevenue / prevPeriodAppointments : 0;
    const ticketChange = prevTicketMedio > 0
      ? Math.round(((ticketMedio - prevTicketMedio) / prevTicketMedio) * 100)
      : null;

    const periodUniqueClients = periodClientIds.length;
    const prevUniqueClients = prevPeriodDistinctClientsGroups.length;
    const clientsChange = prevUniqueClients > 0
      ? Math.round(((periodUniqueClients - prevUniqueClients) / prevUniqueClients) * 100)
      : null;

    const returningClientIds = new Set(clientsBeforePeriod.map((r) => r.clientId));
    const newClients = periodClientIds.filter((id) => !returningClientIds.has(id)).length;
    const returningClients = returningClientIds.size;

    const mrr = activeSubscriptions.reduce((sum, s) => sum + s.plan.price, 0);

    // Projeção
    const diaAtual = getDate(now);
    const diasNoMes = getDaysInMonth(now);
    const monthRevenue = period === "month" ? periodRevenue : 0;
    const projecaoMes = diaAtual > 0 ? (monthRevenue / diaAtual) * diasNoMes : 0;

    // Hoje
    const todayDone = todayAppointments.filter((a) => a.status === "DONE");
    const todayPending = todayAppointments.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED");
    const todayRevenue = todayDone.reduce((s, a) => s + a.price, 0);
    const todayExpectedRevenue = todayAppointments
      .filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW")
      .reduce((s, a) => s + (a.service?.price || 0), 0);

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const nextAppointment = todayAppointments.find((a) => {
      if (a.status !== "CONFIRMED" && a.status !== "PENDING") return false;
      const [h, m] = a.startTime.split(":").map(Number);
      return h * 60 + m >= nowMinutes;
    }) || null;

    const totalComissaoPaga = commissionPayments.reduce((s, p) => s + p.amount, 0);
    const totalVales = commissionVales.reduce((s, v) => s + v.amount, 0);

    // Rankings enrichment
    const barberMap = new Map(barberUsers.map((b) => [b.id, b.user.name]));
    const topBarbers = topBarbersRaw.map((b) => ({
      id: b.barberId,
      name: barberMap.get(b.barberId) || "Profissional",
      revenue: b._sum.price || 0,
      appointments: b._count,
    }));

    const clientMap = new Map(clientUsers.map((c) => [c.id, c.name]));
    const topClients = topClientsRaw.map((c) => ({
      id: c.clientId,
      name: clientMap.get(c.clientId) || "Cliente",
      totalSpent: c._sum.price || 0,
      visits: c._count,
    }));

    const productSalesTotal = periodProductSales._sum.total || 0;

    // NPS
    const calculateNpsMetrics = (reviewsList: typeof periodReviews) => {
      if (reviewsList.length === 0) {
        return { score: null, promoters: 0, passives: 0, detractors: 0, average: 0, total: 0, level: "N/A" };
      }
      const total = reviewsList.length;
      let promoters = 0;
      let passives = 0;
      let detractors = 0;
      let sum = 0;
      reviewsList.forEach((r) => {
        sum += r.rating;
        if (r.rating >= 9) promoters++;
        else if (r.rating >= 7) passives++;
        else detractors++;
      });
      const promoterPct = (promoters / total) * 100;
      const detractorPct = (detractors / total) * 100;
      const score = Math.round(promoterPct - detractorPct);
      const average = Math.round((sum / total) * 10) / 10;
      let level = "BOM";
      if (score >= 75) level = "EXCELENTE";
      else if (score >= 50) level = "MUITO BOM";
      else if (score < 0) level = "CRÍTICO";
      return { score, promoters, passives, detractors, average, total, level };
    };

    const nps = calculateNpsMetrics(periodReviews);
    const prevNps = calculateNpsMetrics(prevPeriodReviews);
    const npsChange = (nps.score !== null && prevNps.score !== null) ? nps.score - prevNps.score : null;

    return NextResponse.json({
      period,
      periodLabel: `${format(periodStart, "dd/MM")} - ${format(periodEnd, "dd/MM")}`,
      nps: {
        score: nps.score,
        change: npsChange,
        level: nps.level,
        average: nps.average,
        total: nps.total,
        promoters: nps.promoters,
        passives: nps.passives,
        detractors: nps.detractors,
      },
      today: {
        appointments: todayAppointments,
        total: todayAppointments.length,
        done: todayDone.length,
        pending: todayPending.length,
        noShow: todayAppointments.filter((a) => a.status === "NO_SHOW").length,
        revenue: todayRevenue,
        expectedRevenue: todayExpectedRevenue,
        nextAppointment,
      },
      whatsapp: {
        status: whatsappInstance?.status || "DISCONNECTED",
        lastConnectedAt: whatsappInstance?.lastConnectedAt || null,
      },
      kpis: {
        revenue: { value: periodRevenue, change: revenueChange, prevValue: prevPeriodRevenue },
        appointments: { value: periodAppointments, change: appointmentsChange, prevValue: prevPeriodAppointments },
        ticketMedio: { value: Math.round(ticketMedio * 100) / 100, change: ticketChange, prevValue: Math.round(prevTicketMedio * 100) / 100 },
        clients: { value: periodUniqueClients, change: clientsChange, prevValue: prevUniqueClients },
        newClients,
        returningClients,
        productSales: productSalesTotal,
      },
      mrr,
      activeSubscriptions: activeSubscriptions.length,
      activeBarbers,
      projecaoMes: Math.round(projecaoMes),
      comissoes: { totalPago: totalComissaoPaga, totalVales, barbeirosPagos: commissionPayments.length },
      topBarbers,
      topClients,
      charts: {
        dailyRevenue,
        appointmentStatus: appointmentStatusCounts,
      },
      birthdaysThisMonth,
      occupation: {
        pct: occupationPct,
        status: occupationStatus,
        usedMinutes: totalUsedMinutes,
        availableMinutes: totalAvailableMinutes,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
