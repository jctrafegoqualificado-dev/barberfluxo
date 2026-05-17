import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  startOfDay, endOfDay, startOfMonth, endOfMonth,
  subDays, subMonths, getDaysInMonth, getDate, format,
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

    // --- FASE 1: Parse period filter ---
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

    // Calculate previous period (same duration, shifted back)
    const periodDays = differenceInDays(periodEnd, periodStart) + 1;
    const prevPeriodEnd = new Date(periodStart.getTime() - 1);
    const prevPeriodStart = startOfDay(subDays(periodStart, periodDays));

    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthKey = format(now, "yyyy-MM");

    // --- PARALLEL QUERIES ---
    const [
      // Today's data
      todayAppointments,
      // Period data
      periodDoneAppointments,
      prevPeriodDoneAppointments,
      // Period product sales
      periodProductSales,
      prevPeriodProductSales,
      // Global counts
      activeSubscriptions,
      activeBarbers,
      // Commissions
      commissionPayments,
      commissionVales,
      // WhatsApp status
      whatsappInstance,
      // Top barbers (period)
      topBarbersRaw,
      // Top clients (period)
      topClientsRaw,
      // NPS Reviews
      periodReviews,
      prevPeriodReviews,
    ] = await Promise.all([
      // Today appointments (always real-time)
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
      // Period DONE appointments
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", date: { gte: periodStart, lte: periodEnd } },
        select: { price: true, clientId: true, barberId: true, date: true },
      }),
      // Previous period DONE appointments (for comparison)
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", date: { gte: prevPeriodStart, lte: prevPeriodEnd } },
        select: { price: true, clientId: true },
      }),
      // Period product sales
      prisma.productSale.aggregate({
        where: { barbershopId, createdAt: { gte: periodStart, lte: periodEnd } },
        _sum: { total: true },
        _count: true,
      }),
      // Previous period product sales
      prisma.productSale.aggregate({
        where: { barbershopId, createdAt: { gte: prevPeriodStart, lte: prevPeriodEnd } },
        _sum: { total: true },
      }),
      // Subscriptions
      prisma.subscription.findMany({
        where: { barbershopId, status: "ACTIVE" },
        include: { plan: { select: { price: true } } },
      }),
      // Active barbers count
      prisma.barber.count({ where: { barbershopId, active: true } }),
      // Commissions (current month)
      prisma.commissionPayment.findMany({ where: { barbershopId, month: monthKey } }),
      prisma.commissionVale.findMany({ where: { barbershopId, month: monthKey } }),
      // WhatsApp instance status
      prisma.whatsAppInstance.findUnique({
        where: { barbershopId },
        select: { status: true, lastConnectedAt: true },
      }),
      // Top barbers by revenue (period)
      prisma.appointment.groupBy({
        by: ["barberId"],
        where: { barbershopId, status: "DONE", date: { gte: periodStart, lte: periodEnd } },
        _sum: { price: true },
        _count: true,
        orderBy: { _sum: { price: "desc" } },
        take: 5,
      }),
      // Top clients by total spent (period)
      prisma.appointment.groupBy({
        by: ["clientId"],
        where: { barbershopId, status: "DONE", date: { gte: periodStart, lte: periodEnd } },
        _sum: { price: true },
        _count: true,
        orderBy: { _sum: { price: "desc" } },
        take: 5,
      }),
      // NPS Reviews
      prisma.review.findMany({
        where: { barbershopId, createdAt: { gte: periodStart, lte: periodEnd } }
      }),
      prisma.review.findMany({
        where: { barbershopId, createdAt: { gte: prevPeriodStart, lte: prevPeriodEnd } }
      }),
    ]);

    // --- CALCULATIONS ---

    // Revenue
    const periodRevenue = periodDoneAppointments.reduce((s, a) => s + a.price, 0);
    const prevPeriodRevenue = prevPeriodDoneAppointments.reduce((s, a) => s + a.price, 0);
    const revenueChange = prevPeriodRevenue > 0
      ? Math.round(((periodRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100)
      : null;

    // Appointments count
    const periodAppointments = periodDoneAppointments.length;
    const prevPeriodAppointments = prevPeriodDoneAppointments.length;
    const appointmentsChange = prevPeriodAppointments > 0
      ? Math.round(((periodAppointments - prevPeriodAppointments) / prevPeriodAppointments) * 100)
      : null;

    // Ticket médio
    const ticketMedio = periodAppointments > 0 ? periodRevenue / periodAppointments : 0;
    const prevTicketMedio = prevPeriodAppointments > 0 ? prevPeriodRevenue / prevPeriodAppointments : 0;
    const ticketChange = prevTicketMedio > 0
      ? Math.round(((ticketMedio - prevTicketMedio) / prevTicketMedio) * 100)
      : null;

    // Unique clients (retention rate)
    const periodClientIds = new Set(periodDoneAppointments.map((a) => a.clientId));
    const prevClientIds = new Set(prevPeriodDoneAppointments.map((a) => a.clientId));
    const periodUniqueClients = periodClientIds.size;
    const prevUniqueClients = prevClientIds.size;
    const clientsChange = prevUniqueClients > 0
      ? Math.round(((periodUniqueClients - prevUniqueClients) / prevUniqueClients) * 100)
      : null;

    // New vs returning clients (this period)
    const clientsBeforePeriod = await prisma.appointment.groupBy({
      by: ["clientId"],
      where: {
        barbershopId, status: "DONE", date: { lt: periodStart },
        clientId: { in: Array.from(periodClientIds) },
      },
      _count: true,
    });
    const returningClientIds = new Set(clientsBeforePeriod.map((r) => r.clientId));
    const newClients = Array.from(periodClientIds).filter((id) => !returningClientIds.has(id)).length;
    const returningClients = returningClientIds.size;

    // MRR
    const mrr = activeSubscriptions.reduce((sum, s) => sum + s.plan.price, 0);

    // Projection (month only)
    const diaAtual = getDate(now);
    const diasNoMes = getDaysInMonth(now);
    const monthRevenue = period === "month" ? periodRevenue : 0;
    const projecaoMes = diaAtual > 0 ? (monthRevenue / diaAtual) * diasNoMes : 0;

    // Today metrics
    const todayDone = todayAppointments.filter((a) => a.status === "DONE");
    const todayPending = todayAppointments.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED");
    const todayRevenue = todayDone.reduce((s, a) => s + a.price, 0);
    const todayExpectedRevenue = todayAppointments
      .filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW")
      .reduce((s, a) => s + (a.service?.price || 0), 0);

    // Next client
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const nextAppointment = todayAppointments.find((a) => {
      if (a.status !== "CONFIRMED" && a.status !== "PENDING") return false;
      const [h, m] = a.startTime.split(":").map(Number);
      return h * 60 + m >= nowMinutes;
    }) || null;

    // Comissões
    const totalComissaoPaga = commissionPayments.reduce((s, p) => s + p.amount, 0);
    const totalVales = commissionVales.reduce((s, v) => s + v.amount, 0);

    // --- FASE 4: RANKINGS ---
    // Top barbers — enrich with names
    const barberIds = topBarbersRaw.map((b) => b.barberId);
    const barberUsers = barberIds.length > 0
      ? await prisma.barber.findMany({
          where: { id: { in: barberIds } },
          include: { user: { select: { name: true } } },
        })
      : [];
    const barberMap = new Map(barberUsers.map((b) => [b.id, b.user.name]));

    const topBarbers = topBarbersRaw.map((b) => ({
      id: b.barberId,
      name: barberMap.get(b.barberId) || "Profissional",
      revenue: b._sum.price || 0,
      appointments: b._count,
    }));

    // Top clients — enrich with names
    const clientIds = topClientsRaw.map((c) => c.clientId);
    const clientUsers = clientIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true },
        })
      : [];
    const clientMap = new Map(clientUsers.map((c) => [c.id, c.name]));

    const topClients = topClientsRaw.map((c) => ({
      id: c.clientId,
      name: clientMap.get(c.clientId) || "Cliente",
      totalSpent: c._sum.price || 0,
      visits: c._count,
    }));

    // Product sales
    const productSalesTotal = periodProductSales._sum.total || 0;

    // NPS & Reviews Calculations
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

      return {
        score,
        promoters,
        passives,
        detractors,
        average,
        total,
        level,
      };
    };

    const nps = calculateNpsMetrics(periodReviews);
    const prevNps = calculateNpsMetrics(prevPeriodReviews);
    let npsChange: number | null = null;
    if (nps.score !== null && prevNps.score !== null) {
      npsChange = nps.score - prevNps.score;
    }

    return NextResponse.json({
      // Period info
      period,
      periodLabel: `${format(periodStart, "dd/MM")} - ${format(periodEnd, "dd/MM")}`,

      // FASE 5: NPS
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

      // FASE 2: Raio-X de Hoje
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

      // WhatsApp status
      whatsapp: {
        status: whatsappInstance?.status || "DISCONNECTED",
        lastConnectedAt: whatsappInstance?.lastConnectedAt || null,
      },

      // FASE 3: KPIs Comparativos
      kpis: {
        revenue: { value: periodRevenue, change: revenueChange, prevValue: prevPeriodRevenue },
        appointments: { value: periodAppointments, change: appointmentsChange, prevValue: prevPeriodAppointments },
        ticketMedio: { value: Math.round(ticketMedio * 100) / 100, change: ticketChange, prevValue: Math.round(prevTicketMedio * 100) / 100 },
        clients: { value: periodUniqueClients, change: clientsChange, prevValue: prevUniqueClients },
        newClients,
        returningClients,
        productSales: productSalesTotal,
      },

      // Extra
      mrr,
      activeSubscriptions: activeSubscriptions.length,
      activeBarbers,
      projecaoMes: Math.round(projecaoMes),
      comissoes: { totalPago: totalComissaoPaga, totalVales, barbeirosPagos: commissionPayments.length },

      // FASE 4: Rankings
      topBarbers,
      topClients,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
