import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  addDaysKey as addDays, apptDuration, barberDayWindow, dowOf as dow, keyOf, makeShopWindow, nowSP, OCC_APPT_SELECT, pctOf as rate, periodRange,
} from "@/lib/ocupacao";

/**
 * Ocupação: quanto do tempo das cadeiras virou atendimento (só comandas fechadas, DONE).
 * Regras do cálculo em src/lib/ocupacao.ts (as mesmas das Metas de ocupação).
 * ?periodo=semana|mes. Devolve também o período anterior inteiro, para comparar.
 */

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

type Appt = { barberId: string; date: Date; startTime: string; duration: number };

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const periodo = req.nextUrl.searchParams.get("periodo") === "semana" ? "semana" : "mes";

    const { today, nowMin } = nowSP();
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
        select: OCC_APPT_SELECT,
      }),
    ]);

    const shopW = makeShopWindow(openingRaw, specialDays);
    const weekly = shopW.weekly;
    const shopWindow = shopW.at;

    const appts: Appt[] = apptsRaw.map((a) => ({
      barberId: a.barberId, date: a.date, startTime: a.startTime,
      duration: apptDuration(a),
    }));
    const barberIds = new Set(barbers.map((b) => b.id));

    const window = (b: (typeof barbers)[number], key: string) => barberDayWindow(b, key, shopWindow, today, nowMin);

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
