/**
 * Ritmo de volta do cliente: de quanto em quanto tempo ele costuma vir e se já
 * passou do prazo ("sumido"). Usado na lista e na ficha de Clientes.
 */

const DAY_MS = 86_400_000;

/** Intervalo médio, em dias, entre visitas em dias diferentes. null com menos de 2 dias distintos. */
export function averageInterval(dates: Date[]): number | null {
  const days = [...new Set(dates.map((d) => Math.floor(d.getTime() / DAY_MS)))].sort((a, b) => a - b);
  if (days.length < 2) return null;
  return Math.round((days[days.length - 1] - days[0]) / (days.length - 1));
}

export interface RhythmInput {
  visits: number;
  /** Intervalo médio entre visitas (dias), se houver. */
  avgFrequency: number | null;
  daysSinceLastVisit: number | null;
  /** Já tem horário marcado para frente — não está sumido. */
  hasUpcoming: boolean;
  /** Prazo usado para quem veio uma vez só (dias de inatividade da retenção; padrão 45). */
  fallbackDays: number;
}

export interface Rhythm {
  /** De quanto em quanto tempo esperamos o cliente (dias). null = nunca veio. */
  expected: number | null;
  lapsed: boolean;
  /** Dias além do esperado (≥ 0). */
  overdueDays: number;
}

/**
 * Sumido = passou do intervalo de costume mais uma folga (25%, mínimo 7 dias) e
 * não tem nada marcado. Quem veio uma vez só usa o prazo da retenção, sem folga.
 */
export function clientRhythm({ visits, avgFrequency, daysSinceLastVisit, hasUpcoming, fallbackDays }: RhythmInput): Rhythm {
  if (visits === 0 || daysSinceLastVisit === null) return { expected: null, lapsed: false, overdueDays: 0 };
  const hasHabit = visits >= 2 && avgFrequency !== null && avgFrequency >= 1;
  const expected = Math.max(7, hasHabit ? avgFrequency! : fallbackDays);
  const grace = hasHabit ? Math.max(7, Math.round(expected * 0.25)) : 0;
  const overdueDays = Math.max(0, daysSinceLastVisit - expected);
  return { expected, lapsed: !hasUpcoming && daysSinceLastVisit > expected + grace, overdueDays };
}

/** Vem todo mês: 3+ visitas, intervalo de até 35 dias e não está sumido. */
export function isFrequent(visits: number, avgFrequency: number | null, lapsed: boolean): boolean {
  return visits >= 3 && avgFrequency !== null && avgFrequency <= 35 && !lapsed;
}

/** Quanto o cliente costumava gastar por mês (ticket médio × visitas por mês). */
export function monthlyValue(totalSpent: number, visits: number, expected: number | null): number {
  if (visits === 0 || !expected) return 0;
  return (totalSpent / visits) * (30 / expected);
}
