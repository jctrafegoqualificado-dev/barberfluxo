import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const barberId = searchParams.get("barberId");
    // Aceita múltiplos serviços (serviceIds=id1,id2) ou um único (serviceId) por compatibilidade
    const serviceIdsParam = searchParams.get("serviceIds");
    const serviceIds = serviceIdsParam
      ? serviceIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [searchParams.get("serviceId")].filter(Boolean) as string[];

    if (!date || !barberId || serviceIds.length === 0) {
      return NextResponse.json({ error: "Parâmetros obrigatórios" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({ where: { slug } });
    if (!shop) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

    const [services, barber] = await Promise.all([
      prisma.service.findMany({ where: { id: { in: serviceIds } } }),
      prisma.barber.findUnique({ where: { id: barberId } }),
    ]);
    if (services.length === 0 || !barber) return NextResponse.json({ slots: [] });

    // Duração total reserva o bloco somado de todos os serviços escolhidos
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

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
    const todayBR = new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(now);
    const isToday = date === todayBR;
    const brTimeStr = new Intl.DateTimeFormat("en", {
      timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);
    const [brH, brM] = brTimeStr.split(":").map(Number);
    // Clientes: buffer de 15min | Barbeiro: sem restrição (pode marcar no passado)
    const nowMinutes = barberMode ? -1 : isToday ? brH * 60 + brM + 15 : 0;

    const [dy, dm, dd] = date.split("-").map(Number);
    const dayStart = new Date(Date.UTC(dy, dm - 1, dd, 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(dy, dm - 1, dd, 23, 59, 59, 999));

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
    for (let m = openMinutes; m + totalDuration <= closeMinutes; m += 15) {
      // Ignora slots passados (barberMode = -1 libera todos)
      if (nowMinutes >= 0 && isToday && m < nowMinutes) continue;

      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const slotEnd = m + totalDuration;

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
