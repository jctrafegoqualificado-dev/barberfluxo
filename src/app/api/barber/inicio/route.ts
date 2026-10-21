import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { appointmentCommission, poolForMonth } from "@/lib/commissions";
import { SUBSCRIPTION_APPT_INCLUDE } from "@/lib/subscriptionServices";
import { averageInterval, clientRhythm } from "@/lib/clientRhythm";
import { addMonth, currentMonthSP, monthStartSP } from "@/lib/monthResult";
import { addDaysKey, todayKeySP } from "@/lib/subscriptionCycle";

/**
 * Início do barbeiro: próximo cliente, ganhos do dia, horários livres, meta do mês,
 * semana, avaliações, clientes para chamar de volta e aniversários.
 * Ganhos usam as mesmas regras das Comissões (avulso pela %, assinante pelo pote).
 */

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toHHMM = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const dayStart = (k: string) => new Date(`${k}T00:00:00Z`);
const dayEnd = (k: string) => new Date(`${k}T23:59:59.999Z`);
const keyOf = (d: Date) => d.toISOString().slice(0, 10);
const DAY_MS = 86_400_000;

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["BARBER", "OWNER"]);
    const barber = await prisma.barber.findUnique({
      where: { userId: payload.id },
      include: { user: { select: { name: true } } },
    });
    if (!barber) return NextResponse.json({ error: "Perfil de barbeiro não encontrado" }, { status: 404 });
    const barbershopId = barber.barbershopId;

    const now = new Date();
    const today = todayKeySP(now);
    const nowMin = toMin(new Intl.DateTimeFormat("en", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(now).replace(/^24/, "00"));
    const month = currentMonthSP(now);
    const monthFirst = `${month}-01`;
    const nextMonthFirst = `${addMonth(month, 1)}-01`;
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    const monday = addDaysKey(today, -((weekday + 6) % 7));
    const weekDays = Array.from({ length: 7 }, (_, i) => addDaysKey(monday, i));
    const lastMonday = addDaysKey(monday, -7);
    const yearAgo = new Date(now.getTime() - 365 * DAY_MS);

    const [todayAppts, blocks, hours, special, pool, meta, monthDone, weekAppts, lastWeekDone, reviews, shopReviews, shop, history] = await Promise.all([
      prisma.appointment.findMany({
        where: { barberId: barber.id, date: { gte: dayStart(today), lte: dayEnd(today) }, status: { not: "CANCELLED" } },
        select: {
          id: true, startTime: true, endTime: true, status: true, price: true, extraPrice: true, tipAmount: true, notes: true, arrivedAt: true, subscriptionId: true,
          client: { select: { id: true, name: true, phone: true, birthday: true } },
          ...SUBSCRIPTION_APPT_INCLUDE,
          service: { select: { id: true, name: true, materialCost: true, commission: true, price: true, duration: true } },
          services: { select: { price: true, service: { select: { id: true, name: true, materialCost: true, commission: true, price: true, duration: true } } } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.scheduleBlock.findMany({ where: { barberId: barber.id, date: { gte: dayStart(today), lte: dayEnd(today) } }, select: { startTime: true, endTime: true } }),
      prisma.openingHour.findFirst({ where: { barbershopId, dayOfWeek: weekday } }),
      prisma.specialDay.findFirst({ where: { barbershopId, date: today } }),
      // Pote do mês com as mesmas regras das Comissões (planos longos divididos, repasse de mês sem serviço)
      poolForMonth(barbershopId, month),
      prisma.meta.findFirst({ where: { barbershopId, barberId: barber.id, tipo: "RECEITA", periodo: "MONTHLY", active: true }, orderBy: { createdAt: "desc" } }),
      prisma.appointment.findMany({
        where: { barberId: barber.id, status: "DONE", date: { gte: dayStart(monthFirst), lt: dayStart(nextMonthFirst) } },
        select: { price: true },
      }),
      prisma.appointment.findMany({
        where: { barberId: barber.id, status: { in: ["DONE", "CONFIRMED", "PENDING"] }, date: { gte: dayStart(weekDays[0]), lte: dayEnd(weekDays[6]) } },
        select: { date: true, price: true, status: true },
      }),
      prisma.appointment.findMany({
        where: { barberId: barber.id, status: "DONE", date: { gte: dayStart(lastMonday), lt: dayStart(monday) } },
        select: { date: true, price: true },
      }),
      prisma.review.findMany({
        where: { barbershopId, barberId: barber.id, createdAt: { gte: monthStartSP(month) } },
        orderBy: { createdAt: "desc" },
        select: { rating: true, comment: true, createdAt: true, client: { select: { name: true } } },
      }),
      prisma.review.aggregate({ where: { barbershopId, createdAt: { gte: monthStartSP(month) } }, _avg: { rating: true } }),
      prisma.barbershop.findUnique({ where: { id: barbershopId }, select: { retentionDays: true } }),
      // Clientes atendidos por ele no último ano (chamar de volta e aniversários)
      prisma.appointment.findMany({
        where: { barberId: barber.id, status: "DONE", date: { gte: yearAgo } },
        select: { clientId: true, date: true },
      }),
    ]);

    // ── Ganhos de hoje (mesma conta das Comissões) ──
    const ticket = pool.ticket;
    const commissionOf = (a: (typeof todayAppts)[number]) => appointmentCommission(a, barber, ticket);
    const done = todayAppts.filter((a) => a.status === "DONE");
    const open = todayAppts.filter((a) => a.status === "CONFIRMED" || a.status === "PENDING");
    const earned = done.reduce((s, a) => s + commissionOf(a) + (a.tipAmount ?? 0), 0);
    const projected = earned + open.reduce((s, a) => s + commissionOf(a), 0);

    // ── Próximo cliente: o primeiro em aberto que ainda não terminou ──
    const next = open.find((a) => toMin(a.endTime) > nowMin) ?? null;
    // Horários que já passaram e ninguém fechou a comanda nem marcou falta
    const unclosed = open.filter((a) => toMin(a.endTime) <= nowMin).map((a) => ({ id: a.id, startTime: a.startTime, name: a.client.name }));
    const label = (a: (typeof todayAppts)[number]) =>
      a.services.length ? a.services.map((s) => s.service.name).join(" + ") : a.service?.name ?? "Atendimento";
    const bdaySoon = (b: Date | null) => {
      if (!b) return null;
      for (let i = 0; i <= 7; i++) {
        const k = addDaysKey(today, i);
        if (k.slice(5) === keyOf(b).slice(5)) return i === 0 ? "faz aniversário hoje" : `faz aniversário dia ${Number(k.slice(8))}`;
      }
      return null;
    };

    // ── Horários livres de hoje (dentro do expediente, a partir de agora) ──
    const isOpen = special ? !special.isClosed : !!hours?.isOpen;
    const openT = special && !special.isClosed ? special.openTime : hours?.openTime;
    const closeT = special && !special.isClosed ? special.closeTime : hours?.closeTime;
    const workStart = Math.max(toMin(barber.workStart || openT || "09:00"), openT ? toMin(openT) : 0);
    const workEnd = Math.min(toMin(barber.workEnd || closeT || "19:00"), closeT ? toMin(closeT) : 24 * 60);
    const busy = [...todayAppts.map((a) => [toMin(a.startTime), toMin(a.endTime)]), ...blocks.map((b) => [toMin(b.startTime), toMin(b.endTime)])].sort((x, y) => x[0] - y[0]);
    const shortest = Math.min(30, ...todayAppts.flatMap((a) => (a.service?.duration ? [a.service.duration] : [])));
    const free: { start: string; end: string; minutes: number; fits: number }[] = [];
    if (isOpen && barber.active && !barber.onVacation) {
      let cursor = Math.max(workStart, Math.ceil(nowMin / 15) * 15);
      for (const [s, e] of [...busy, [workEnd, workEnd]]) {
        const end = Math.min(s, workEnd);
        if (end - cursor >= shortest) free.push({ start: toHHMM(cursor), end: toHHMM(end), minutes: end - cursor, fits: Math.floor((end - cursor) / 30) });
        cursor = Math.max(cursor, e);
        if (cursor >= workEnd) break;
      }
    }

    // ── Semana: realizado, agendado e mesmo dia da semana passada ──
    const sumBy = (rows: { date: Date; price: number }[], k: string) => rows.filter((r) => keyOf(r.date) === k).reduce((s, r) => s + r.price, 0);
    const week = weekDays.map((k, i) => ({
      date: k,
      real: sumBy(weekAppts.filter((a) => a.status === "DONE"), k),
      sched: k >= today ? sumBy(weekAppts.filter((a) => a.status !== "DONE"), k) : 0,
      last: sumBy(lastWeekDone, addDaysKey(lastMonday, i)),
    }));
    const scheduledWeek = week.reduce((s, d) => s + d.sched, 0);

    // ── Meta do mês (receita dos atendimentos concluídos, igual à tela de Metas) ──
    const monthRevenue = monthDone.reduce((s, a) => s + a.price, 0);
    let daysLeft = 0;
    const openDays = await prisma.openingHour.findMany({ where: { barbershopId, isOpen: true }, select: { dayOfWeek: true } });
    const openSet = new Set(openDays.map((d) => d.dayOfWeek));
    for (let k = today; k < nextMonthFirst; k = addDaysKey(k, 1)) if (openSet.has(new Date(`${k}T12:00:00Z`).getUTCDay())) daysLeft++;
    const target = meta?.valorAlvo ?? null;

    // ── Clientes para chamar de volta e aniversários ──
    const byClient = new Map<string, Date[]>();
    for (const h of history) byClient.set(h.clientId, [...(byClient.get(h.clientId) ?? []), h.date]);
    const clientIds = [...byClient.keys()];
    const [clients, lastAnywhere, upcoming] = clientIds.length ? await Promise.all([
      prisma.user.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true, phone: true, birthday: true } }),
      prisma.appointment.groupBy({ by: ["clientId"], where: { barbershopId, clientId: { in: clientIds }, status: "DONE" }, _max: { date: true } }),
      prisma.appointment.findMany({
        where: { barbershopId, clientId: { in: clientIds }, status: { in: ["CONFIRMED", "PENDING"] }, date: { gte: dayStart(today) } },
        select: { clientId: true }, distinct: ["clientId"],
      }),
    ]) : [[], [], []];
    const lastBy = new Map(lastAnywhere.map((l) => [l.clientId, l._max.date]));
    const upcomingSet = new Set(upcoming.map((u) => u.clientId));
    const comeback = clients
      .map((c) => {
        const dates = byClient.get(c.id) ?? [];
        const lastMine = dates.reduce((m, d) => (d > m ? d : m), dates[0]);
        const lastAny = lastBy.get(c.id) ?? lastMine;
        // Se a última visita foi com outro profissional, o cliente é dele agora
        if (lastAny && lastAny > lastMine) return null;
        const days = Math.floor((now.getTime() - lastMine.getTime()) / DAY_MS);
        const r = clientRhythm({ visits: dates.length, avgFrequency: averageInterval(dates), daysSinceLastVisit: days, hasUpcoming: upcomingSet.has(c.id), fallbackDays: shop?.retentionDays ?? 45 });
        if (!r.lapsed) return null;
        return { clientId: c.id, name: c.name, phone: c.phone, overdue: r.overdueDays, note: r.expected ? `vinha a cada ${r.expected} dias · última há ${days}` : `veio 1 vez · há ${days} dias` };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.overdue - a.overdue)
      .slice(0, 5);
    const birthdays = clients
      .map((c) => {
        if (!c.birthday) return null;
        const md = keyOf(c.birthday).slice(5);
        for (let i = 0; i <= 7; i++) {
          const k = addDaysKey(today, i);
          if (k.slice(5) === md) return { clientId: c.id, name: c.name, phone: c.phone, date: k, inDays: i, visits: (byClient.get(c.id) ?? []).length };
        }
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.inDays - b.inDays)
      .slice(0, 5);

    const res = NextResponse.json({
      name: barber.user.name,
      today, nowMin,
      next: next && {
        id: next.id, startTime: next.startTime, endTime: next.endTime, status: next.status, arrived: !!next.arrivedAt,
        minutesUntil: toMin(next.startTime) - nowMin,
        client: { id: next.client.id, name: next.client.name, phone: next.client.phone },
        services: label(next), price: next.price, notes: next.notes, birthday: bdaySoon(next.client.birthday),
      },
      unclosed,
      day: { total: todayAppts.length, done: done.length, open: open.length, noShow: todayAppts.filter((a) => a.status === "NO_SHOW").length, earned, projected },
      free, freeMinutes: free.reduce((s, f) => s + f.minutes, 0), isOpen,
      meta: { target, revenue: monthRevenue, daysLeft, perDay: target && daysLeft ? Math.max(0, (target - monthRevenue) / daysLeft) : null, scheduledWeek, month },
      week,
      reviews: {
        count: reviews.length,
        avg: reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null,
        shopAvg: shopReviews._avg.rating,
        comments: reviews.filter((r) => r.comment).slice(0, 2).map((r) => ({ client: r.client.name, rating: r.rating, comment: r.comment, at: r.createdAt })),
      },
      comeback,
      birthdays,
    });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
