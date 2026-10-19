import { prisma } from "@/lib/prisma";

/**
 * Horário da barbearia num dia (AAAA-MM-DD): o dia especial (feriado, horário diferente)
 * vale sobre o horário da semana. null = fechada.
 *
 * Usado por tudo que oferece ou grava horário para o cliente: atendente de IA (API v1 slots,
 * next-slots e appointments) e link de agendamento. Antes a IA só olhava o horário da semana
 * e conseguia marcar em feriado cadastrado como fechado.
 */
export interface ShopDayHours { openTime: string; closeTime: string; reason: string | null }

const dowOf = (date: string) => new Date(date + "T12:00:00Z").getUTCDay();

export async function shopHoursOn(barbershopId: string, date: string): Promise<ShopDayHours | null> {
  const map = await shopHoursFor(barbershopId, [date]);
  return map.get(date) ?? null;
}

/** Vários dias de uma vez (ex.: próximos horários livres da IA). */
export async function shopHoursFor(barbershopId: string, dates: string[]): Promise<Map<string, ShopDayHours | null>> {
  const [weekly, specials] = await Promise.all([
    prisma.openingHour.findMany({ where: { barbershopId }, select: { dayOfWeek: true, isOpen: true, openTime: true, closeTime: true } }),
    prisma.specialDay.findMany({ where: { barbershopId, date: { in: dates } } }),
  ]);
  const out = new Map<string, ShopDayHours | null>();
  for (const date of dates) {
    const sp = specials.find((s) => s.date === date);
    if (sp) {
      out.set(date, sp.isClosed || !sp.openTime || !sp.closeTime ? null : { openTime: sp.openTime, closeTime: sp.closeTime, reason: sp.reason });
      continue;
    }
    const oh = weekly.find((w) => w.dayOfWeek === dowOf(date));
    out.set(date, oh?.isOpen ? { openTime: oh.openTime, closeTime: oh.closeTime, reason: null } : null);
  }
  return out;
}
