/**
 * Ciclo de cobrança e situação de uma assinatura de cliente.
 *
 * O vencimento (nextBillingDate) guarda um DIA: o que vale é a data em UTC (o código antigo
 * grava meia-noite UTC; o servidor local grava 03:00 UTC — os dois caem no mesmo dia).
 * "Hoje" é o dia em São Paulo.
 */

export type BillingCycle = "MONTHLY" | "QUARTERLY" | "YEARLY" | string;

export function cycleMonths(cycle: BillingCycle): number {
  return cycle === "QUARTERLY" ? 3 : cycle === "YEARLY" ? 12 : 1;
}

/** Valor equivalente por mês (plano trimestral de R$ 300 = R$ 100/mês). */
export function monthlyValue(price: number, cycle: BillingCycle): number {
  return price / cycleMonths(cycle);
}

export const CYCLE_LABEL: Record<string, string> = { MONTHLY: "mês", QUARTERLY: "trimestre", YEARLY: "ano" };

/** Dia do vencimento (YYYY-MM-DD). */
export function dueKey(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

/** Hoje em São Paulo (YYYY-MM-DD). */
export function todayKeySP(now = new Date()): string {
  return new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(now);
}

/** Início do dia (YYYY-MM-DD) como meia-noite UTC — limite para filtrar vencimentos. */
export function dayStartUTC(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

export function addDaysKey(key: string, days: number): string {
  const d = dayStartUTC(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dias entre dois dias (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((dayStartUTC(b).getTime() - dayStartUTC(a).getTime()) / 86_400_000);
}

function lastDay(y: number, m: number) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/**
 * Próximo vencimento depois de pagar: anda 1 ciclo do plano (1, 3 ou 12 meses) e respeita
 * o dia fixo de cobrança (dia 31 vira o último dia do mês). Grava ao meio-dia UTC.
 */
export function advanceDue(current: Date | string, billingDay: number | null | undefined, cycle: BillingCycle, dir: 1 | -1 = 1): Date {
  const [y, m, d] = dueKey(current).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + dir * cycleMonths(cycle), 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth();
  const day = Math.min(billingDay || d, lastDay(ty, tm));
  return new Date(Date.UTC(ty, tm, day, 12));
}

export type SubState = "cancelled" | "paused" | "failed" | "late" | "today" | "auth" | "ok";

export interface SubLike {
  status: string;
  nextBillingDate: Date | string;
  authorizationStatus?: string | null;
}

/** Situação que aparece na lista (ordem de prioridade: o que pede ação primeiro). */
export function subState(sub: SubLike, today = todayKeySP()): { state: SubState; lateDays: number } {
  if (sub.status === "CANCELLED") return { state: "cancelled", lateDays: 0 };
  if (sub.status === "PAUSED") return { state: "paused", lateDays: 0 };
  const due = dueKey(sub.nextBillingDate);
  const lateDays = Math.max(0, daysBetween(due, today));
  if (sub.authorizationStatus === "FAILED") return { state: "failed", lateDays };
  if (lateDays > 0 || sub.status === "OVERDUE") return { state: "late", lateDays };
  if (due === today) return { state: "today", lateDays: 0 };
  if (sub.authorizationStatus === "PENDING_AUTH") return { state: "auth", lateDays: 0 };
  return { state: "ok", lateDays: 0 };
}
