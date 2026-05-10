import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const barbers = await prisma.barber.findMany({
      where: { barbershopId, active: true },
      include: { user: { select: { name: true } } },
    });

    // Atendimentos do mês passado e deste mês
    const [lastMonthAppts, thisMonthAppts, allAppts] = await Promise.all([
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", date: { gte: lastMonthStart, lte: lastMonthEnd } },
        select: { barberId: true, clientId: true },
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", date: { gte: thisMonthStart, lte: thisMonthEnd } },
        select: { barberId: true, clientId: true },
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE" },
        select: { barberId: true, clientId: true, date: true },
        orderBy: { date: "asc" },
      }),
    ]);

    // Índices rápidos por barbeiro
    const lastMonthByBarber: Record<string, Set<string>> = {};
    for (const a of lastMonthAppts) {
      if (!lastMonthByBarber[a.barberId]) lastMonthByBarber[a.barberId] = new Set();
      lastMonthByBarber[a.barberId].add(a.clientId);
    }

    const thisMonthByBarber: Record<string, Set<string>> = {};
    for (const a of thisMonthAppts) {
      if (!thisMonthByBarber[a.barberId]) thisMonthByBarber[a.barberId] = new Set();
      thisMonthByBarber[a.barberId].add(a.clientId);
    }

    // Frequência média: visitas consecutivas por cliente/barbeiro
    type VisitEntry = { clientId: string; date: Date };
    const allByBarber: Record<string, VisitEntry[]> = {};
    for (const a of allAppts) {
      if (!allByBarber[a.barberId]) allByBarber[a.barberId] = [];
      allByBarber[a.barberId].push({ clientId: a.clientId, date: new Date(a.date) });
    }

    const porBarbeiro = barbers.map((b) => {
      const lastMonthClients = lastMonthByBarber[b.id] ?? new Set();
      const thisMonthClients = thisMonthByBarber[b.id] ?? new Set();
      const retornaram = Array.from(lastMonthClients).filter((cid) => thisMonthClients.has(cid)).length;
      const taxaRetorno = lastMonthClients.size > 0
        ? Math.round((retornaram / lastMonthClients.size) * 100)
        : null;

      // Frequência média de visita para clientes deste barbeiro
      const visits = allByBarber[b.id] ?? [];
      const visitsByClient: Record<string, Date[]> = {};
      for (const v of visits) {
        if (!visitsByClient[v.clientId]) visitsByClient[v.clientId] = [];
        visitsByClient[v.clientId].push(v.date);
      }

      let totalIntervals = 0;
      let intervalCount = 0;
      for (const dates of Object.values(visitsByClient)) {
        const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
        for (let i = 1; i < sorted.length; i++) {
          totalIntervals += differenceInDays(sorted[i], sorted[i - 1]);
          intervalCount++;
        }
      }
      const mediaFrequencia = intervalCount > 0 ? Math.round(totalIntervals / intervalCount) : null;

      return {
        id: b.id,
        name: b.user.name,
        clientesMesPassado: lastMonthClients.size,
        clientesRetornaram: retornaram,
        taxaRetorno,
        mediaFrequencia,
        totalClientesUnicos: Object.keys(visitsByClient).length,
      };
    });

    // Taxa geral da barbearia
    const totalLastMonth = new Set(lastMonthAppts.map((a) => a.clientId)).size;
    const totalRetornaram = Array.from(new Set(lastMonthAppts.map((a) => a.clientId)))
      .filter((cid) => thisMonthAppts.some((a) => a.clientId === cid)).length;
    const taxaGeralRetorno = totalLastMonth > 0 ? Math.round((totalRetornaram / totalLastMonth) * 100) : 0;

    return NextResponse.json({ porBarbeiro, taxaGeralRetorno, totalLastMonth, totalRetornaram });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
