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

    // 3 queries em paralelo (antes: 2 awaits sequenciais com include enorme)
    const [dbClients, reviewsAgg] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: "CLIENT",
          OR: [
            { appointments: { some: { barbershopId } } },
            { subscriptions: { some: { barbershopId } } }
          ]
        },
        include: {
          appointments: {
            where: { barbershopId, status: "DONE" },
            select: { date: true, price: true },
            orderBy: { date: "asc" }
          },
          subscriptions: {
            where: { barbershopId, status: "ACTIVE" },
            include: { plan: { select: { name: true } } }
          }
        }
      }),
      prisma.review.aggregate({
        where: { barbershopId },
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    const totalReviews = reviewsAgg._count;
    const moral = totalReviews > 0 ? Math.round((reviewsAgg._avg.rating ?? 0) * 10) / 10 : 5.0;

    const clientes = dbClients.map((u) => {
      const sortedVisits = u.appointments.map(a => new Date(a.date)).sort((a, b) => a.getTime() - b.getTime());
      const totalSpent = u.appointments.reduce((sum, a) => sum + a.price, 0);
      const firstVisit = sortedVisits.length > 0 ? sortedVisits[0] : null;
      const lastVisit = sortedVisits.length > 0 ? sortedVisits[sortedVisits.length - 1] : null;
      const thisMonthVisits = sortedVisits.filter((d) => d >= monthStart && d <= monthEnd).length;
      
      // Se tiver assinatura, usa a data da assinatura como "primeira interação" se não houver visitas
      const firstInteraction = firstVisit || (u.subscriptions[0] ? new Date(u.subscriptions[0].createdAt) : now);
      const isNew = firstInteraction >= monthStart;

      let avgFrequency: number | null = null;
      if (sortedVisits.length > 1) {
        let totalDays = 0;
        for (let i = 1; i < sortedVisits.length; i++) {
          totalDays += differenceInDays(sortedVisits[i], sortedVisits[i - 1]);
        }
        avgFrequency = Math.round(totalDays / (sortedVisits.length - 1));
      }

      const daysSinceLastVisit = lastVisit ? differenceInDays(now, lastVisit) : null;

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        isBlocked: u.isBlocked,
        birthday: u.birthday ? u.birthday.toISOString() : null,
        totalVisits: sortedVisits.length,
        totalSpent,
        thisMonthVisits,
        firstVisit: firstVisit?.toISOString() || null,
        lastVisit: lastVisit?.toISOString() || null,
        daysSinceLastVisit,
        avgFrequency,
        isNew,
        activePlan: u.subscriptions[0]?.plan.name ?? null,
      };
    });

    // Ordena por quem interagiu por último (agendamento ou assinatura)
    clientes.sort((a, b) => {
      const dateA = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
      const dateB = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ clientes, moral });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
