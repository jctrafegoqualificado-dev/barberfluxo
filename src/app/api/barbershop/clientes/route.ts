import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfMonth, endOfMonth, differenceInDays } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let barbershopId = payload.barbershopId!;
    let barberIdFilter: string | undefined;

    if (payload.role === "BARBER") {
      const barber = await prisma.barber.findUnique({ where: { userId: payload.id } });
      if (!barber) return NextResponse.json({ clientes: [] });
      barbershopId = barber.barbershopId;
      barberIdFilter = barber.id;
    }

    // Todos os agendamentos DONE desta barbearia (ou deste barbeiro)
    const appointments = await prisma.appointment.findMany({
      where: { barbershopId, status: "DONE", ...(barberIdFilter ? { barberId: barberIdFilter } : {}) },
      include: { client: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { date: "asc" },
    });

    // Assinaturas ativas por cliente
    const subscriptions = await prisma.subscription.findMany({
      where: { barbershopId, status: "ACTIVE" },
      select: { clientId: true, plan: { select: { name: true } } },
    });
    const subByClient: Record<string, string> = {};
    for (const s of subscriptions) {
      subByClient[s.clientId] = s.plan.name;
    }

    // Agrupa por cliente
    const clientMap: Record<string, {
      id: string; name: string; email: string; phone: string | null;
      visits: Date[]; totalSpent: number;
    }> = {};

    for (const appt of appointments) {
      const cid = appt.clientId;
      if (!clientMap[cid]) {
        clientMap[cid] = {
          id: cid,
          name: appt.client.name,
          email: appt.client.email,
          phone: appt.client.phone,
          visits: [],
          totalSpent: 0,
        };
      }
      clientMap[cid].visits.push(new Date(appt.date));
      clientMap[cid].totalSpent += appt.price;
    }

    // Computa métricas por cliente
    const clientes = Object.values(clientMap).map((c) => {
      const sorted = c.visits.sort((a, b) => a.getTime() - b.getTime());
      const firstVisit = sorted[0];
      const lastVisit = sorted[sorted.length - 1];
      const thisMonthVisits = sorted.filter((d) => d >= monthStart && d <= monthEnd).length;
      const isNew = firstVisit >= monthStart;

      // Frequência média: média de dias entre visitas consecutivas
      let avgFrequency: number | null = null;
      if (sorted.length > 1) {
        let totalDays = 0;
        for (let i = 1; i < sorted.length; i++) {
          totalDays += differenceInDays(sorted[i], sorted[i - 1]);
        }
        avgFrequency = Math.round(totalDays / (sorted.length - 1));
      }

      const daysSinceLastVisit = differenceInDays(now, lastVisit);

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        totalVisits: sorted.length,
        totalSpent: c.totalSpent,
        thisMonthVisits,
        firstVisit: firstVisit.toISOString(),
        lastVisit: lastVisit.toISOString(),
        daysSinceLastVisit,
        avgFrequency,
        isNew,
        activePlan: subByClient[c.id] ?? null,
      };
    });

    // Ordena por última visita (mais recente primeiro)
    clientes.sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());

    return NextResponse.json({ clientes });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
