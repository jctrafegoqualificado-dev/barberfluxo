/**
 * Horário de atendimento próprio de cada barbeiro (ex.: das 11:00 às 20:00).
 *
 * É um horário único para a semana toda. Sem horário configurado (workStart/workEnd
 * nulos), o barbeiro segue o horário de funcionamento da barbearia, como antes.
 * Com horário configurado, os horários livres oferecidos ao cliente ficam dentro da
 * interseção entre o horário da barbearia e o do barbeiro — a barbearia fechada
 * continua fechada para todos. Imprevistos de um dia continuam com "Bloquear".
 *
 * Usado por todos os cálculos de horário livre: link de agendamento, API v1
 * (slots e next-slots) e robô do WhatsApp.
 */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export type BarberHours = { workStart?: string | null; workEnd?: string | null };

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Janela (em minutos desde 00:00) em que o barbeiro pode receber agendamentos,
 * dado o horário da barbearia naquele dia. Se o resultado tiver start >= end,
 * não há horário disponível.
 */
export function barberWorkWindow(
  shopOpenMin: number,
  shopCloseMin: number,
  barber: BarberHours,
): { start: number; end: number } {
  const { workStart, workEnd } = barber;
  if (!workStart || !workEnd || !HHMM.test(workStart) || !HHMM.test(workEnd)) {
    return { start: shopOpenMin, end: shopCloseMin };
  }
  return {
    start: Math.max(shopOpenMin, toMin(workStart)),
    end: Math.min(shopCloseMin, toMin(workEnd)),
  };
}

/**
 * Normaliza e valida o horário enviado pelo formulário.
 * Os dois vazios = segue o horário da barbearia.
 */
export function parseBarberHours(
  workStart: unknown,
  workEnd: unknown,
): { ok: true; workStart: string | null; workEnd: string | null } | { ok: false; error: string } {
  const start = typeof workStart === "string" ? workStart.trim() : "";
  const end = typeof workEnd === "string" ? workEnd.trim() : "";
  if (!start && !end) return { ok: true, workStart: null, workEnd: null };
  if (!start || !end) return { ok: false, error: "Informe o início e o fim do horário de atendimento." };
  if (!HHMM.test(start) || !HHMM.test(end)) return { ok: false, error: "Horário de atendimento inválido (use HH:MM)." };
  if (toMin(start) >= toMin(end)) return { ok: false, error: "O fim do horário de atendimento deve ser depois do início." };
  return { ok: true, workStart: start, workEnd: end };
}

/** Texto para exibição, ex.: "11:00 às 20:00". Null quando segue a barbearia. */
export function barberHoursLabel(barber: BarberHours): string | null {
  return barber.workStart && barber.workEnd ? `${barber.workStart} às ${barber.workEnd}` : null;
}
