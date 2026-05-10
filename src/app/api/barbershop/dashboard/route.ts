import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, getDaysInMonth, getDate, subMonths, format } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const prevMonthStart = startOfMonth(subMonths(today, 1));
    const prevMonthEnd = endOfMonth(subMonths(today, 1));
    const monthKey = format(today, "yyyy-MM");

    const [
      todayAppointments,
      monthDoneAppointments,
      allTimeDoneAppointments,
      activeSubscriptions,
      barbers,
      commissionPayments,
      commissionVales,
    ] = await Promise.all([
      prisma.appointment.findMany({
        where: { barbershopId, date: { gte: startOfDay(today), lte: endOfDay(today) } },
        include: { client: true, barber: { include: { user: true } }, service: true },
        orderBy: { startTime: "asc" },
      }),
      prisma.appointment.findMany({
        where: { barbershopId, date: { gte: monthStart, lte: monthEnd }, status: "DONE" },
        select: { price: true, clientId: true },
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE" },
        select: { clientId: true, date: true },
        orderBy: { date: "asc" },
      }),
      prisma.subscription.count({ where: { barbershopId, status: "ACTIVE" } }),
      prisma.barber.count({ where: { barbershopId, active: true } }),
      prisma.commissionPayment.findMany({ where: { barbershopId, month: monthKey } }),
      prisma.commissionVale.findMany({ where: { barbershopId, month: monthKey } }),
    ]);

    const monthRevenue = monthDoneAppointments.reduce((sum, a) => sum + a.price, 0);
    const todayRevenue = todayAppointments.filter((a) => a.status === "DONE").reduce((sum, a) => sum + a.price, 0);

    // Projeção do mês: receita ÷ dias decorridos × dias no mês
    const diaAtual = getDate(today);
    const diasNoMes = getDaysInMonth(today);
    const projecaoMes = diaAtual > 0 ? (monthRevenue / diaAtual) * diasNoMes : 0;

    // Clientes novos vs recorrentes este mês
    const thisMonthClientIds = new Set(monthDoneAppointments.map((a) => a.clientId));

    // Para cada cliente deste mês, verificar se tem visita ANTES do início do mês
    const prevVisitCounts = await prisma.appointment.groupBy({
      by: ["clientId"],
      where: {
        barbershopId,
        status: "DONE",
        date: { lt: monthStart },
        clientId: { in: Array.from(thisMonthClientIds) },
      },
      _count: true,
    });
    const clientsWithPrevVisit = new Set(prevVisitCounts.map((r) => r.clientId));

    const clientesNovos = Array.from(thisMonthClientIds).filter((id) => !clientsWithPrevVisit.has(id)).length;
    const clientesRecorrentes = Array.from(thisMonthClientIds).filter((id) => clientsWithPrevVisit.has(id)).length;

    // Total de clientes únicos de todos os tempos
    const totalClients = new Set(allTimeDoneAppointments.map((a) => a.clientId)).size;

    // Receita mês anterior para comparação
    const prevMonthRevenue = await prisma.appointment.aggregate({
      where: { barbershopId, status: "DONE", date: { gte: prevMonthStart, lte: prevMonthEnd } },
      _sum: { price: true },
    });
    const receitaMesAnterior = prevMonthRevenue._sum.price ?? 0;
    const variacaoReceita = receitaMesAnterior > 0
      ? Math.round(((monthRevenue - receitaMesAnterior) / receitaMesAnterior) * 100)
      : null;

    const totalComissaoPaga = commissionPayments.reduce((s, p) => s + p.amount, 0);
    const totalVales = commissionVales.reduce((s, v) => s + v.amount, 0);
    const barbeirosPagos = commissionPayments.length;

    return NextResponse.json({
      todayAppointments,
      monthRevenue,
      todayRevenue,
      projecaoMes: Math.round(projecaoMes),
      activeSubscriptions,
      totalClients,
      activeBarbers: barbers,
      pendingToday: todayAppointments.filter((a) => a.status === "PENDING").length,
      doneToday: todayAppointments.filter((a) => a.status === "DONE").length,
      clientesNovos,
      clientesRecorrentes,
      receitaMesAnterior,
      variacaoReceita,
      comissoes: { totalPago: totalComissaoPaga, totalVales, barbeirosPagos },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
