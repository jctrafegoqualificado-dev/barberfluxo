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

const WEEKDAY_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/**
 * GET /api/v1/barbershops/{slug}/next-slots
 *
 * Retorna os próximos horários livres dos próximos N dias em uma única chamada.
 * Projetado para o assistente IA do N8N sugerir horários sem múltiplas requisições.
 *
 * Query params:
 *   serviceId  (obrigatório) — ID do serviço
 *   days       (opcional, default 7, max 14) — quantos dias à frente buscar
 *   barberId   (opcional) — filtrar por barbeiro específico
 *
 * Aceita slug puro ou instanceName da Evolution como {slug}.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);

    const serviceId = searchParams.get("serviceId");
    const barberIdFilter = searchParams.get("barberId") ?? undefined;
    const daysParam = Math.min(parseInt(searchParams.get("days") ?? "7", 10) || 7, 14);

    if (!serviceId) {
      return NextResponse.json({ error: "Parâmetro serviceId obrigatório" }, { status: 400 });
    }

    // Resolve barbearia por slug ou instanceName (mesmo padrão do ai-config)
    let shop = await prisma.barbershop.findUnique({
      where: { slug },
      select: { id: true, active: true },
    });

    if (!shop) {
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { evolutionInstanceName: slug },
        select: { barbershop: { select: { id: true, active: true } } },
      });
      if (instance?.barbershop) shop = instance.barbershop;
    }

    if (!shop || !shop.active) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    // Valida serviço
    const service = await prisma.service.findFirst({
      where: { id: serviceId, barbershopId: shop.id, active: true },
      select: { id: true, name: true, duration: true, price: true },
    });
    if (!service) {
      return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });
    }

    // Barbeiros ativos (ou só o filtrado)
    const barbers = await prisma.barber.findMany({
      where: {
        barbershopId: shop.id,
        active: true,
        ...(barberIdFilter ? { id: barberIdFilter } : {}),
      },
      select: { id: true, dayOff: true, user: { select: { name: true } }, nickname: true },
    });

    if (barbers.length === 0) {
      return NextResponse.json({ error: "Nenhum barbeiro disponível" }, { status: 404 });
    }

    // Horários de funcionamento da barbearia (todos os dias de uma vez)
    const openingHours = await prisma.openingHour.findMany({
      where: { barbershopId: shop.id },
      select: { dayOfWeek: true, isOpen: true, openTime: true, closeTime: true },
    });
    const openingMap = Object.fromEntries(openingHours.map((o) => [o.dayOfWeek, o]));

    // Janela de datas: hoje até hoje + daysParam
    const nowBRT = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );
    const currentMinutesBRT = nowBRT.getHours() * 60 + nowBRT.getMinutes();

    const dateStrings: string[] = [];
    for (let i = 0; i < daysParam; i++) {
      const d = new Date(nowBRT);
      d.setDate(d.getDate() + i);
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      dateStrings.push(`${y}-${mo}-${da}`);
    }

    // Busca todos os agendamentos e bloqueios da janela de uma vez
    const windowStart = new Date(dateStrings[0] + "T00:00:00Z");
    const windowEnd = new Date(dateStrings[dateStrings.length - 1] + "T23:59:59Z");

    const [appointments, blocks] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          barbershopId: shop.id,
          date: { gte: windowStart, lte: windowEnd },
          status: { not: "CANCELLED" },
        },
        select: { barberId: true, date: true, startTime: true, endTime: true },
      }),
      prisma.scheduleBlock.findMany({
        where: {
          barberId: { in: barbers.map((b) => b.id) },
          date: { gte: windowStart, lte: windowEnd },
        },
        select: { barberId: true, date: true, startTime: true, endTime: true },
      }),
    ]);

    // Indexa busy slots por barberId + dateStr
    function dateKey(d: Date) {
      return d.toISOString().slice(0, 10);
    }
    const busyMap: Record<string, { start: number; end: number }[]> = {};
    for (const a of [...appointments, ...blocks]) {
      const key = `${a.barberId}:${dateKey(a.date)}`;
      if (!busyMap[key]) busyMap[key] = [];
      busyMap[key].push({ start: toMinutes(a.startTime), end: toMinutes(a.endTime) });
    }

    // Monta resposta
    const days = [];

    for (const dateStr of dateStrings) {
      const dayOfWeek = new Date(dateStr + "T12:00:00Z").getDay();
      const opening = openingMap[dayOfWeek];
      if (!opening || !opening.isOpen) continue;

      const openMin = toMinutes(opening.openTime);
      const closeMin = toMinutes(opening.closeTime);
      const isToday = dateStr === dateStrings[0];

      const barbersWithSlots = [];

      for (const barber of barbers) {
        if (barber.dayOff === dayOfWeek) continue;

        const busy = busyMap[`${barber.id}:${dateStr}`] ?? [];
        const slots: string[] = [];

        for (let start = openMin; start + service.duration <= closeMin; start += 15) {
          // Para hoje, ignora slots que já passaram (+ 30min de margem)
          if (isToday && start <= currentMinutesBRT + 30) continue;

          const end = start + service.duration;
          const conflict = busy.some((b) => start < b.end && end > b.start);
          if (!conflict) slots.push(toHHMM(start));
        }

        if (slots.length > 0) {
          barbersWithSlots.push({
            id: barber.id,
            name: barber.user.name,
            nickname: barber.nickname ?? null,
            slots,
          });
        }
      }

      if (barbersWithSlots.length > 0) {
        days.push({
          date: dateStr,
          weekday: WEEKDAY_PT[dayOfWeek],
          barbers: barbersWithSlots,
        });
      }
    }

    return NextResponse.json({
      service: {
        id: service.id,
        name: service.name,
        duration: service.duration,
        price: service.price,
      },
      days,
      meta: {
        daysSearched: daysParam,
        daysWithAvailability: days.length,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
