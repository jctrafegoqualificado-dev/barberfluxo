import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const barberId = searchParams.get("barberId");
    const serviceId = searchParams.get("serviceId");

    if (!date || !barberId || !serviceId) {
      return NextResponse.json({ error: "Parâmetros obrigatórios" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({ where: { slug } });
    if (!shop) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

    const [service, barber] = await Promise.all([
      prisma.service.findUnique({ where: { id: serviceId } }),
      prisma.barber.findUnique({ where: { id: barberId } }),
    ]);
    if (!service || !barber) return NextResponse.json({ slots: [] });

    const d = new Date(date + "T12:00:00");
    const dayOfWeek = d.getDay();

    // Verifica folga do barbeiro
    if (barber.dayOff !== null && barber.dayOff === dayOfWeek) {
      return NextResponse.json({ slots: [] });
    }

    // Verifica dia especial (feriado ou horário customizado)
    const specialDay = await prisma.specialDay.findUnique({
      where: { barbershopId_date: { barbershopId: shop.id, date } },
    });
    if (specialDay?.isClosed) return NextResponse.json({ slots: [] });

    let openingHour: { openTime: string; closeTime: string } | null = null;
    if (specialDay && !specialDay.isClosed && specialDay.openTime && specialDay.closeTime) {
      openingHour = { openTime: specialDay.openTime, closeTime: specialDay.closeTime };
    } else {
      openingHour = await prisma.openingHour.findFirst({
        where: { barbershopId: shop.id, dayOfWeek, isOpen: true },
      });
    }
    if (!openingHour) return NextResponse.json({ slots: [] });

    const [openH, openM] = openingHour.openTime.split(":").map(Number);
    const [closeH, closeM] = openingHour.closeTime.split(":").map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    // Horário mínimo baseado no fuso do Brasil (UTC-3)
    const barberMode = req.nextUrl.searchParams.get("barber") === "true";
    const now = new Date();
    const brNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const todayBR = `${brNow.getFullYear()}-${String(brNow.getMonth() + 1).padStart(2, "0")}-${String(brNow.getDate()).padStart(2, "0")}`;
    const isToday = date === todayBR;
    // Clientes: buffer de 15min | Barbeiro: sem restrição (pode marcar no passado)
    const nowMinutes = barberMode ? -1 : isToday ? brNow.getHours() * 60 + brNow.getMinutes() + 15 : 0;

    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

    // Agendamentos e bloqueios do barbeiro nesse dia
    const [existing, blocks] = await Promise.all([
      prisma.appointment.findMany({
        where: { barberId, date: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELLED" } },
      }),
      prisma.scheduleBlock.findMany({
        where: { barberId, date: { gte: dayStart, lte: dayEnd } },
      }),
    ]);

    function toMin(t: string) {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    }

    const slots: string[] = [];
    for (let m = openMinutes; m + service.duration <= closeMinutes; m += 15) {
      // Ignora slots passados (barberMode = -1 libera todos)
      if (nowMinutes >= 0 && isToday && m < nowMinutes) continue;

      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const slotEnd = m + service.duration;

      // Conflito com agendamentos existentes
      const apptConflict = existing.some((a) => {
        const aStart = toMin(a.startTime);
        const aEnd = toMin(a.endTime);
        return m < aEnd && slotEnd > aStart;
      });

      // Conflito com bloqueios de agenda
      const blockConflict = blocks.some((b) => {
        const bStart = toMin(b.startTime);
        const bEnd = toMin(b.endTime);
        return m < bEnd && slotEnd > bStart;
      });

      if (!apptConflict && !blockConflict) slots.push(`${hh}:${mm}`);
    }

    return NextResponse.json({ slots });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
