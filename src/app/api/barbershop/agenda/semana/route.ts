import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/barbershop/agenda/semana?date=AAAA-MM-DD
 *
 * Para a faixa da semana da agenda (segunda a domingo da semana de `date`):
 * quantos horários cada dia tem e se a barbearia abre. Também devolve o horário
 * de funcionamento de `date` (já com dia especial), usado na ocupação por profissional.
 */
export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const date = req.nextUrl.searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Data inválida" }, { status: 400 });

    // Barbeiro vê só os horários dele na faixa da semana
    const own = payload.role === "BARBER"
      ? await prisma.barber.findUnique({ where: { userId: payload.id }, select: { id: true } })
      : null;

    const ref = new Date(date + "T12:00:00Z");
    const monday = new Date(ref);
    monday.setUTCDate(ref.getUTCDate() - ((ref.getUTCDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });

    const [grouped, hours, specials] = await Promise.all([
      prisma.appointment.groupBy({
        by: ["date"],
        where: {
          barbershopId,
          ...(own ? { barberId: own.id } : {}),
          status: { not: "CANCELLED" },
          date: { gte: new Date(days[0] + "T00:00:00Z"), lte: new Date(days[6] + "T23:59:59Z") },
        },
        _count: { _all: true },
      }),
      prisma.openingHour.findMany({ where: { barbershopId } }),
      prisma.specialDay.findMany({ where: { barbershopId, date: { in: days } } }),
    ]);

    const countByDay = new Map(grouped.map((g) => [g.date.toISOString().slice(0, 10), g._count._all]));
    const hoursFor = (day: string) => {
      const special = specials.find((s) => s.date === day);
      if (special) {
        return special.isClosed
          ? { isOpen: false, open: null, close: null, reason: special.reason }
          : { isOpen: true, open: special.openTime, close: special.closeTime, reason: special.reason };
      }
      const oh = hours.find((h) => h.dayOfWeek === new Date(day + "T12:00:00Z").getUTCDay());
      return oh?.isOpen ? { isOpen: true, open: oh.openTime, close: oh.closeTime, reason: null } : { isOpen: false, open: null, close: null, reason: null };
    };

    return NextResponse.json({
      days: days.map((d) => ({ date: d, count: countByDay.get(d) ?? 0, isOpen: hoursFor(d).isOpen })),
      hours: hoursFor(date),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
