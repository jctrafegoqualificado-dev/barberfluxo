import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { todayKeySP } from "@/lib/subscriptionCycle";
import { barberWorkWindow } from "@/lib/barberHours";

/**
 * Ocupação: quanto do tempo das cadeiras virou atendimento (só comandas fechadas, DONE).
 *
 * Tempo disponível = para cada dia que JÁ passou no período (hoje conta até agora), para cada
 * profissional ativo: a janela da barbearia naquele dia (dia especial > horário da semana)
 * cruzada com o horário próprio do profissional, menos a folga fixa dele.
 * Tempo ocupado = duração dos serviços das comandas fechadas.
 *
 * ?periodo=semana|mes. Devolve também o período anterior inteiro, para comparar.
 */

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const keyOf = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (key: string, n: number) => { const d = new Date(key + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return keyOf(d); };
const dow = (key: string) => new Date(key + "T12:00:00Z").getUTCDay();
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const rate = (occ: number, avail: number) => (avail > 0 ? Math.min(100, Math.round((occ / avail) * 100)) : null);

function periodRange(periodo: string, today: string) {
  if (periodo === "semana") {
    const start = addDays(today, -((dow(today) + 6) % 7)); // segunda
    return { start, end: addDays(start, 6), prevStart: addDays(start, -7), prevEnd: addDays(start, -1) };
  }
  const start = today.slice(0, 8) + "01";
  const next = new Date(start + "T12:00:00Z"); next.setUTCMonth(next.getUTCMonth() + 1);
  const end = addDays(keyOf(next), -1);
  const prev = new Date(start + "T12:00:00Z"); prev.setUTCMonth(prev.getUTCMonth() - 1);
  return { start, end, prevStart: keyOf(prev), prevEnd: addDays(start, -1) };
}

type Appt = { barberId: string; date: Date; startTime: string; duration: number };

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const periodo = req.nextUrl.searchParams.get("periodo") === "semana" ? "semana" : "mes";

    const today = todayKeySP();
    const nowParts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    const nowMin = toMin(nowParts);
    const { start, end, prevStart, prevEnd } = periodRange(periodo, today);

    const [openingRaw, specialDays, barbers, apptsRaw] = await Promise.all([
      prisma.openingHour.findMany({ where: { barbershopId } }),
      prisma.specialDay.findMany({ where: { barbershopId, date: { gte: prevStart, lte: end } } }),
      prisma.barber.findMany({
        where: { barbershopId, active: true, archivedAt: null },
        select: { id: true, nickname: true, dayOff: true, workStart: true, workEnd: true, user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", date: { gte: new Date(prevStart + "T00:00:00Z"), lte: new Date(end + "T23:59:59Z") } },
        select: {
          barberId: true, date: true, startTime: true,
          service: { select: { duration: true } },
          services: { select: { duration: true, service: { select: { duration: true } } } },
        },
      }),
    ]);

    // Sem horário cadastrado: seg–sáb 09–20 (mesmo padrão de antes)
    const weekly: Record<number, [number, number] | null> = {};
    for (let d = 0; d < 7; d++) weekly[d] = null;
    if (openingRaw.length === 0) for (let d = 1; d <= 6; d++) weekly[d] = [540, 1200];
    for (const o of openingRaw) weekly[o.dayOfWeek] = o.isOpen ? [toMin(o.openTime), toMin(o.closeTime)] : null;
    const special = new Map(specialDays.map((s) => [s.date, s]));
    const shopWindow = (key: string): [number, number] | null => {
      const s = special.get(key);
      if (s) return s.isClosed || !s.openTime || !s.closeTime ? null : [toMin(s.openTime), toMin(s.closeTime)];
      return weekly[dow(key)];
    };

    const appts: Appt[] = apptsRaw.map((a) => ({
      barberId: a.barberId, date: a.date, startTime: a.startTime,
      duration: a.services.length ? a.services.reduce((s, x) => s + (x.duration ?? x.service?.duration ?? 0), 0) : a.service?.duration ?? 0,
    }));
    const barberIds = new Set(barbers.map((b) => b.id));

    // Janela de trabalho de um profissional num dia (null = não trabalha); hoje corta em "agora"
    const window = (b: (typeof barbers)[number], key: string): [number, number] | null => {
      const w = shopWindow(key);
      if (!w || b.dayOff === dow(key)) return null;
      const { start: s, end: e } = barberWorkWindow(w[0], w[1], b);
      const cut = key === today ? Math.min(e, nowMin) : e;
      return cut > s ? [s, cut] : null;
    };

    /** Soma de um intervalo de dias [from, to] já passados. */
    function compute(from: string, to: string) {
      const last = to < today ? to : today;
      const days: string[] = [];
      for (let k = from; k <= last; k = addDays(k, 1)) days.push(k);
      const perBarber: Record<string, { occ: number; avail: number; count: number }> = {};
      for (const b of barbers) perBarber[b.id] = { occ: 0, avail: 0, count: 0 };
      const perDay: Record<string, { occ: number; avail: number; count: number }> = {};
      for (const k of days) {
        perDay[k] = { occ: 0, avail: 0, count: 0 };
        for (const b of barbers) {
          const w = window(b, k);
          if (w) { perDay[k].avail += w[1] - w[0]; perBarber[b.id].avail += w[1] - w[0]; }
        }
      }
      for (const a of appts) {
        const k = keyOf(a.date);
        if (!perDay[k] || !barberIds.has(a.barberId)) continue;
        perDay[k].occ += a.duration; perDay[k].count++;
        perBarber[a.barberId].occ += a.duration; perBarber[a.barberId].count++;
      }
      const occ = Object.values(perDay).reduce((s, d) => s + d.occ, 0);
      const avail = Object.values(perDay).reduce((s, d) => s + d.avail, 0);
      return { days, perDay, perBarber, occ, avail, count: Object.values(perDay).reduce((s, d) => s + d.count, 0) };
    }

    const cur = compute(start, end);
    const prev = compute(prevStart, prevEnd);

    // Mapa dia da semana × hora, para a barbearia toda e por profissional
    let minH = 24, maxH = 0;
    for (let d = 0; d < 7; d++) {
      const w = weekly[d];
      if (w) { minH = Math.min(minH, Math.floor(w[0] / 60)); maxH = Math.max(maxH, Math.ceil(w[1] / 60)); }
    }
    for (const s of specialDays) if (!s.isClosed && s.openTime && s.closeTime) { minH = Math.min(minH, Math.floor(toMin(s.openTime) / 60)); maxH = Math.max(maxH, Math.ceil(toMin(s.closeTime) / 60)); }
    if (minH >= maxH) { minH = 9; maxH = 20; }
    const hours = Array.from({ length: maxH - minH }, (_, i) => minH + i);
    const emptyGrid = () => Array.from({ length: 7 }, () => hours.map(() => [0, 0] as [number, number]));
    const grids: Record<string, [number, number][][]> = { all: emptyGrid() };
    for (const b of barbers) grids[b.id] = emptyGrid();
    for (const k of cur.days) {
      const d = dow(k);
      for (const b of barbers) {
        const w = window(b, k);
        if (!w) continue;
        hours.forEach((h, i) => {
          const av = overlap(w[0], w[1], h * 60, h * 60 + 60);
          grids[b.id][d][i][1] += av; grids.all[d][i][1] += av;
        });
      }
    }
    for (const a of appts) {
      const k = keyOf(a.date);
      if (!cur.perDay[k] || !barberIds.has(a.barberId) || !/^\d{2}:\d{2}$/.test(a.startTime)) continue;
      const s = toMin(a.startTime), e = s + a.duration, d = dow(k);
      hours.forEach((h, i) => {
        const oc = overlap(s, e, h * 60, h * 60 + 60);
        grids[a.barberId][d][i][0] += oc; grids.all[d][i][0] += oc;
      });
    }
    const heat = Object.fromEntries(Object.entries(grids).map(([id, g]) => [id, g.map((row) => row.map(([o, a]) => rate(o, a)))]));

    // Dias do período (os que ainda não chegaram vêm como "future")
    const porDia: { data: string; taxa: number | null; atendimentos: number; status: "open" | "closed" | "future" }[] = [];
    for (let k = start; k <= end; k = addDays(k, 1)) {
      if (k > today) porDia.push({ data: k, taxa: null, atendimentos: 0, status: shopWindow(k) ? "future" : "closed" });
      else {
        const v = cur.perDay[k];
        porDia.push({ data: k, taxa: rate(v.occ, v.avail), atendimentos: v.count, status: v.avail > 0 ? "open" : "closed" });
      }
    }
    const openDays = porDia.filter((d) => d.status === "open" && d.taxa != null && d.data !== today);
    const ranked = [...openDays].sort((a, b) => (b.taxa ?? 0) - (a.taxa ?? 0));

    const res = NextResponse.json({
      periodo, start, end, today,
      taxaGeral: rate(cur.occ, cur.avail) ?? 0,
      taxaAnterior: rate(prev.occ, prev.avail),
      totalOcupadoGeral: cur.occ,
      totalDisponivelGeral: cur.avail,
      totalAtendimentos: cur.count,
      diasAbertos: porDia.filter((d) => d.status === "open").length,
      porBarbeiro: barbers.map((b) => {
        const v = cur.perBarber[b.id];
        return { id: b.id, name: b.nickname || b.user.name, atendimentos: v.count, minOcupados: v.occ, minDisponiveis: v.avail, taxa: rate(v.occ, v.avail) ?? 0 };
      }).sort((a, b) => b.taxa - a.taxa),
      porDia,
      melhorDia: ranked[0] ?? null,
      piorDia: ranked.length > 1 ? ranked[ranked.length - 1] : null,
      hours,
      heat,
    });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 });
  }
}
