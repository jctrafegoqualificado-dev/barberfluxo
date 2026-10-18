import { prisma } from "@/lib/prisma";
import { todayKeySP } from "@/lib/subscriptionCycle";
import { barberWorkWindow } from "@/lib/barberHours";

/**
 * Peças do cálculo de ocupação, usadas pela tela de Ocupação e pelas Metas (tipo OCUPACAO),
 * para as duas darem o mesmo número.
 *
 * Tempo disponível = para cada dia que já passou (hoje conta até agora), para cada profissional:
 * a janela da barbearia naquele dia (dia especial > horário da semana) cruzada com o horário
 * próprio dele, menos a folga fixa. Tempo ocupado = duração dos serviços das comandas fechadas.
 */

export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const keyOf = (d: Date) => d.toISOString().slice(0, 10);
export const addDaysKey = (key: string, n: number) => { const d = new Date(key + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return keyOf(d); };
export const dowOf = (key: string) => new Date(key + "T12:00:00Z").getUTCDay();
export const pctOf = (occ: number, avail: number) => (avail > 0 ? Math.min(100, Math.round((occ / avail) * 100)) : null);

export function nowSP() {
  const t = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  return { today: todayKeySP(), nowMin: toMin(t) };
}

/** Semana (segunda a domingo) ou mês do dia `today`, e o período anterior. */
export function periodRange(periodo: "semana" | "mes", today: string) {
  if (periodo === "semana") {
    const start = addDaysKey(today, -((dowOf(today) + 6) % 7));
    return { start, end: addDaysKey(start, 6), prevStart: addDaysKey(start, -7), prevEnd: addDaysKey(start, -1) };
  }
  const start = today.slice(0, 8) + "01";
  const next = new Date(start + "T12:00:00Z"); next.setUTCMonth(next.getUTCMonth() + 1);
  const prev = new Date(start + "T12:00:00Z"); prev.setUTCMonth(prev.getUTCMonth() - 1);
  return { start, end: addDaysKey(keyOf(next), -1), prevStart: keyOf(prev), prevEnd: addDaysKey(start, -1) };
}

type Opening = { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string };
type Special = { date: string; isClosed: boolean; openTime: string | null; closeTime: string | null };
export type OccBarber = { id: string; dayOff: number | null; workStart: string | null; workEnd: string | null };

/** Janela da barbearia num dia, em minutos; null = fechada. Sem horário cadastrado: seg–sáb 09–20. */
export function makeShopWindow(opening: Opening[], specials: Special[]) {
  const weekly: Record<number, [number, number] | null> = {};
  for (let d = 0; d < 7; d++) weekly[d] = null;
  if (opening.length === 0) for (let d = 1; d <= 6; d++) weekly[d] = [540, 1200];
  for (const o of opening) weekly[o.dayOfWeek] = o.isOpen ? [toMin(o.openTime), toMin(o.closeTime)] : null;
  const special = new Map(specials.map((s) => [s.date, s]));
  const fn = (key: string): [number, number] | null => {
    const s = special.get(key);
    if (s) return s.isClosed || !s.openTime || !s.closeTime ? null : [toMin(s.openTime), toMin(s.closeTime)];
    return weekly[dowOf(key)];
  };
  return { weekly, at: fn };
}

/** Janela de trabalho de um profissional num dia (null = não trabalha); hoje corta em "agora". */
export function barberDayWindow(
  b: OccBarber, key: string, shopAt: (k: string) => [number, number] | null, today: string, nowMin: number, cutToday = true
): [number, number] | null {
  const w = shopAt(key);
  if (!w || b.dayOff === dowOf(key)) return null;
  const { start: s, end: e } = barberWorkWindow(w[0], w[1], b);
  const cut = cutToday && key === today ? Math.min(e, nowMin) : e;
  return cut > s ? [s, cut] : null;
}

export function apptDuration(a: { service?: { duration: number } | null; services: { duration: number | null; service?: { duration: number } | null }[] }) {
  return a.services.length ? a.services.reduce((s, x) => s + (x.duration ?? x.service?.duration ?? 0), 0) : a.service?.duration ?? 0;
}

export const OCC_APPT_SELECT = {
  barberId: true, date: true, startTime: true,
  service: { select: { duration: true } },
  services: { select: { duration: true, service: { select: { duration: true } } } },
} as const;

/** Ocupação de [from, to] (só a parte que já passou), da barbearia ou de um profissional. */
export async function occupancy(barbershopId: string, from: string, to: string, barberId?: string | null) {
  const { today, nowMin } = nowSP();
  const [opening, specials, barbers, appts] = await Promise.all([
    prisma.openingHour.findMany({ where: { barbershopId } }),
    prisma.specialDay.findMany({ where: { barbershopId, date: { gte: from, lte: to } } }),
    prisma.barber.findMany({
      where: { barbershopId, active: true, archivedAt: null, ...(barberId ? { id: barberId } : {}) },
      select: { id: true, dayOff: true, workStart: true, workEnd: true },
    }),
    prisma.appointment.findMany({
      where: { barbershopId, status: "DONE", ...(barberId ? { barberId } : {}), date: { gte: new Date(from + "T00:00:00Z"), lte: new Date(to + "T23:59:59Z") } },
      select: OCC_APPT_SELECT,
    }),
  ]);
  const shop = makeShopWindow(opening, specials);
  const last = to < today ? to : today;
  const ids = new Set(barbers.map((b) => b.id));
  let avail = 0;
  for (let k = from; k <= last; k = addDaysKey(k, 1)) {
    for (const b of barbers) { const w = barberDayWindow(b, k, shop.at, today, nowMin); if (w) avail += w[1] - w[0]; }
  }
  const occ = appts.filter((a) => ids.has(a.barberId) && keyOf(a.date) <= last).reduce((s, a) => s + apptDuration(a), 0);
  return { occ, avail, rate: pctOf(occ, avail) };
}

/**
 * Quanto do período já passou, em dias com a barbearia aberta (hoje conta pela hora).
 * Usado para "onde a meta deveria estar hoje" e "quanto por dia falta".
 */
export async function openDaysProgress(barbershopId: string, from: string, to: string) {
  const { today, nowMin } = nowSP();
  const [opening, specials] = await Promise.all([
    prisma.openingHour.findMany({ where: { barbershopId } }),
    prisma.specialDay.findMany({ where: { barbershopId, date: { gte: from, lte: to } } }),
  ]);
  const shop = makeShopWindow(opening, specials);
  let total = 0, elapsed = 0, remaining = 0;
  for (let k = from; k <= to; k = addDaysKey(k, 1)) {
    const w = shop.at(k);
    if (!w) continue;
    total++;
    if (k < today) elapsed++;
    else if (k === today) {
      const frac = Math.min(1, Math.max(0, (nowMin - w[0]) / (w[1] - w[0])));
      elapsed += frac; remaining += 1 - frac;
    } else remaining++;
  }
  return { total, elapsed, remaining };
}
