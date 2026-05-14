import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number) {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const barberId = searchParams.get("barberId");
    const serviceId = searchParams.get("serviceId");

    if (!date || !barberId || !serviceId) {
      return NextResponse.json({ error: "Parâmetros obrigatórios: date, barberId, serviceId" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({ where: { slug }, select: { id: true, active: true } });
    if (!shop || !shop.active) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const [barber, service] = await Promise.all([
      prisma.barber.findFirst({
        where: { id: barberId, barbershopId: shop.id, active: true },
        select: { id: true, dayOff: true },
      }),
      prisma.service.findFirst({
        where: { id: serviceId, barbershopId: shop.id, active: true },
        select: { id: true, duration: true },
      }),
    ]);
    if (!barber) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
    if (!service) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });

    const dayStart = new Date(`${date}T00:00:00`);
    if (isNaN(dayStart.getTime())) {
      return NextResponse.json({ error: "Data inválida (use YYYY-MM-DD)" }, { status: 400 });
    }
    const dayOfWeek = dayStart.getDay();
    if (barber.dayOff === dayOfWeek) {
      return NextResponse.json({ date, dayOfWeek, slots: [] });
    }

    const opening = await prisma.openingHour.findUnique({
      where: { barbershopId_dayOfWeek: { barbershopId: shop.id, dayOfWeek } },
    });
    if (!opening || !opening.isOpen) {
      return NextResponse.json({ date, dayOfWeek, slots: [] });
    }

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const [appointments, blocks] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          barberId: barber.id,
          date: { gte: dayStart, lte: dayEnd },
          status: { not: "CANCELLED" },
        },
        select: { startTime: true, endTime: true },
      }),
      prisma.scheduleBlock.findMany({
        where: { barberId: barber.id, date: { gte: dayStart, lte: dayEnd } },
        select: { startTime: true, endTime: true },
      }),
    ]);

    const busy = [...appointments, ...blocks].map((b) => ({
      start: toMinutes(b.startTime),
      end: toMinutes(b.endTime),
    }));

    const openMin = toMinutes(opening.openTime);
    const closeMin = toMinutes(opening.closeTime);
    const duration = service.duration;
    const step = 15;

    const slots: string[] = [];
    for (let start = openMin; start + duration <= closeMin; start += step) {
      const end = start + duration;
      const conflict = busy.some((b) => start < b.end && end > b.start);
      if (!conflict) slots.push(toHHMM(start));
    }

    return NextResponse.json({ date, dayOfWeek, duration, slots });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
