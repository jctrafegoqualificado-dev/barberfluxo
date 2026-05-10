import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, format, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get("periodo") || "mes"; // semana | mes

    const now = new Date();
    const start = periodo === "semana" ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
    const end = periodo === "semana" ? endOfWeek(now, { weekStartsOn: 1 }) : endOfMonth(now);

    // Horários de funcionamento da barbearia
    const openingHours = await prisma.openingHour.findMany({
      where: { barbershopId, isOpen: true },
    });

    const minutesByDay: Record<number, number> = {};
    for (const oh of openingHours) {
      minutesByDay[oh.dayOfWeek] = timeToMinutes(oh.closeTime) - timeToMinutes(oh.openTime);
    }

    // Barbeiros ativos
    const barbers = await prisma.barber.findMany({
      where: { barbershopId, active: true },
      include: { user: { select: { name: true } } },
    });

    // Apenas comandas fechadas (serviços efetivamente realizados)
    const appointments = await prisma.appointment.findMany({
      where: {
        barbershopId,
        date: { gte: start, lte: end },
        status: "DONE",
      },
      include: { service: true },
    });

    // Dias úteis no período
    const days = eachDayOfInterval({ start, end });
    const diasUteis = days.filter((d) => minutesByDay[getDay(d)] !== undefined);

    // Minutos disponíveis por barbeiro no período
    const minDisponiveisPorBarbeiro = diasUteis.reduce((sum, d) => {
      return sum + (minutesByDay[getDay(d)] || 0);
    }, 0);

    // Total disponível (todos os barbeiros × dias úteis)
    const totalDisponivelGeral = minDisponiveisPorBarbeiro * barbers.length;

    // Minutos ocupados por barbeiro
    const barberStats: Record<string, { name: string; minOcupados: number; atendimentos: number }> = {};
    for (const b of barbers) {
      barberStats[b.id] = { name: b.user.name, minOcupados: 0, atendimentos: 0 };
    }

    let totalOcupadoGeral = 0;
    for (const appt of appointments) {
      if (barberStats[appt.barberId]) {
        barberStats[appt.barberId].minOcupados += appt.service.duration;
        barberStats[appt.barberId].atendimentos += 1;
        totalOcupadoGeral += appt.service.duration;
      }
    }

    // Taxa geral
    const taxaGeral = totalDisponivelGeral > 0
      ? Math.min(Math.round((totalOcupadoGeral / totalDisponivelGeral) * 100), 100)
      : 0;

    // Por barbeiro
    const porBarbeiro = Object.entries(barberStats).map(([id, b]) => ({
      id,
      name: b.name,
      atendimentos: b.atendimentos,
      minOcupados: b.minOcupados,
      minDisponiveis: minDisponiveisPorBarbeiro,
      taxa: minDisponiveisPorBarbeiro > 0
        ? Math.min(Math.round((b.minOcupados / minDisponiveisPorBarbeiro) * 100), 100)
        : 0,
    })).sort((a, b) => b.taxa - a.taxa);

    // Ocupação por dia (para gráfico)
    const porDia = diasUteis.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      const dayOfWeek = getDay(d);
      const minDisp = (minutesByDay[dayOfWeek] || 0) * barbers.length;
      const minOcup = appointments
        .filter((a) => format(new Date(a.date), "yyyy-MM-dd") === dateStr)
        .reduce((s, a) => s + a.service.duration, 0);
      const taxa = minDisp > 0 ? Math.min(Math.round((minOcup / minDisp) * 100), 100) : 0;
      return {
        data: dateStr,
        label: format(d, "EEE dd/MM", { locale: ptBR }),
        taxa,
        atendimentos: appointments.filter((a) => format(new Date(a.date), "yyyy-MM-dd") === dateStr).length,
      };
    });

    // Melhor e pior dia
    const diasComMovimento = porDia.filter((d) => d.atendimentos > 0);
    const melhorDia = diasComMovimento.sort((a, b) => b.taxa - a.taxa)[0] || null;
    const piorDia = diasComMovimento.sort((a, b) => a.taxa - b.taxa)[0] || null;

    return NextResponse.json({
      periodo,
      taxaGeral,
      totalOcupadoGeral,
      totalDisponivelGeral,
      totalAtendimentos: appointments.length,
      diasUteis: diasUteis.length,
      porBarbeiro,
      porDia,
      melhorDia,
      piorDia,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
