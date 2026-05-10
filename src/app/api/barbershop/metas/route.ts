import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";

async function calcularProgresso(
  tipo: string,
  periodo: string,
  barbershopId: string,
  barberId?: string | null
): Promise<number> {
  const now = new Date();
  const start = periodo === "WEEKLY"
    ? startOfWeek(now, { weekStartsOn: 1 })
    : startOfMonth(now);
  const end = periodo === "WEEKLY"
    ? endOfWeek(now, { weekStartsOn: 1 })
    : endOfMonth(now);

  const whereAppt: Record<string, unknown> = {
    barbershopId,
    status: "DONE",
    date: { gte: start, lte: end },
  };
  if (barberId) whereAppt.barberId = barberId;

  if (tipo === "ATENDIMENTOS") {
    return prisma.appointment.count({ where: whereAppt });
  }

  if (tipo === "RECEITA") {
    const appts = await prisma.appointment.findMany({
      where: whereAppt,
      select: { price: true },
    });
    return appts.reduce((s, a) => s + a.price, 0);
  }

  if (tipo === "ASSINANTES") {
    return prisma.subscription.count({
      where: { barbershopId, status: "ACTIVE" },
    });
  }

  if (tipo === "OCUPACAO") {
    const barbers = await prisma.barber.findMany({
      where: { barbershopId, active: true, ...(barberId ? { id: barberId } : {}) },
    });
    const openingHours = await prisma.openingHour.findMany({
      where: { barbershopId, isOpen: true },
    });
    const minutesByDay: Record<number, number> = {};
    for (const oh of openingHours) {
      const [oh2, om] = oh.openTime.split(":").map(Number);
      const [ch, cm] = oh.closeTime.split(":").map(Number);
      minutesByDay[oh.dayOfWeek] = (ch * 60 + cm) - (oh2 * 60 + om);
    }
    const appts = await prisma.appointment.findMany({
      where: whereAppt,
      include: { service: true },
    });
    const totalOcup = appts.reduce((s, a) => s + a.service.duration, 0);
    let totalDisp = 0;
    const d = new Date(start);
    while (d <= end) {
      const dow = d.getDay();
      if (minutesByDay[dow]) totalDisp += minutesByDay[dow] * barbers.length;
      d.setDate(d.getDate() + 1);
    }
    return totalDisp > 0 ? Math.round((totalOcup / totalDisp) * 100) : 0;
  }

  return 0;
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const metas = await prisma.meta.findMany({
      where: { barbershopId, active: true },
      include: { barber: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    // Calcula progresso de cada meta em paralelo
    const metasComProgresso = await Promise.all(
      metas.map(async (m) => {
        const atual = await calcularProgresso(m.tipo, m.periodo, barbershopId, m.barberId);
        const pct = Math.min(Math.round((atual / m.valorAlvo) * 100), 100);
        return { ...m, atual, pct };
      })
    );

    return NextResponse.json({ metas: metasComProgresso });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { titulo, tipo, periodo, valorAlvo, barberId } = await req.json();

    const meta = await prisma.meta.create({
      data: {
        titulo,
        tipo,
        periodo,
        valorAlvo: Number(valorAlvo),
        barbershopId: payload.barbershopId!,
        barberId: barberId || null,
      },
      include: { barber: { include: { user: { select: { name: true } } } } },
    });

    return NextResponse.json({ meta }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
