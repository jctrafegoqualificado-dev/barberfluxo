import { describe, it, expect } from "vitest";
import { averageInterval, clientRhythm, isFrequent, monthlyValue } from "@/lib/clientRhythm";

const d = (s: string) => new Date(s + "T12:00:00Z");

describe("averageInterval", () => {
  it("média entre dias distintos", () => {
    expect(averageInterval([d("2026-01-01"), d("2026-01-22"), d("2026-02-12")])).toBe(21);
  });
  it("dois atendimentos no mesmo dia contam como uma visita", () => {
    expect(averageInterval([d("2026-01-01"), d("2026-01-01"), d("2026-01-31")])).toBe(30);
  });
  it("menos de 2 dias distintos = sem ritmo", () => {
    expect(averageInterval([d("2026-01-01"), d("2026-01-01")])).toBeNull();
    expect(averageInterval([])).toBeNull();
  });
});

describe("clientRhythm", () => {
  const base = { visits: 14, avgFrequency: 21, hasUpcoming: false, fallbackDays: 45 };

  it("sumido: 38 dias com costume de 21 (17 além do normal)", () => {
    expect(clientRhythm({ ...base, daysSinceLastVisit: 38 })).toEqual({ expected: 21, lapsed: true, overdueDays: 17 });
  });
  it("dentro da folga (21 + 7) ainda não é sumido", () => {
    expect(clientRhythm({ ...base, daysSinceLastVisit: 28 }).lapsed).toBe(false);
    expect(clientRhythm({ ...base, daysSinceLastVisit: 29 }).lapsed).toBe(true);
  });
  it("folga de 25% para quem vem de longe em longe", () => {
    // 60 dias de costume → folga 15
    expect(clientRhythm({ ...base, avgFrequency: 60, daysSinceLastVisit: 75 }).lapsed).toBe(false);
    expect(clientRhythm({ ...base, avgFrequency: 60, daysSinceLastVisit: 76 }).lapsed).toBe(true);
  });
  it("com horário marcado não é sumido", () => {
    expect(clientRhythm({ ...base, daysSinceLastVisit: 90, hasUpcoming: true }).lapsed).toBe(false);
  });
  it("veio uma vez: usa o prazo da retenção", () => {
    const one = { visits: 1, avgFrequency: null, hasUpcoming: false, fallbackDays: 45 };
    expect(clientRhythm({ ...one, daysSinceLastVisit: 45 }).lapsed).toBe(false);
    expect(clientRhythm({ ...one, daysSinceLastVisit: 46 })).toEqual({ expected: 45, lapsed: true, overdueDays: 1 });
  });
  it("nunca veio: sem ritmo", () => {
    expect(clientRhythm({ visits: 0, avgFrequency: null, daysSinceLastVisit: null, hasUpcoming: false, fallbackDays: 45 }))
      .toEqual({ expected: null, lapsed: false, overdueDays: 0 });
  });
  it("intervalo mínimo de 7 dias", () => {
    expect(clientRhythm({ ...base, avgFrequency: 2, daysSinceLastVisit: 10 }).expected).toBe(7);
  });
});

describe("isFrequent / monthlyValue", () => {
  it("frequente: 3+ visitas, até 35 dias, não sumido", () => {
    expect(isFrequent(3, 30, false)).toBe(true);
    expect(isFrequent(2, 30, false)).toBe(false);
    expect(isFrequent(5, 40, false)).toBe(false);
    expect(isFrequent(5, 20, true)).toBe(false);
  });
  it("valor por mês = ticket médio × visitas por mês", () => {
    expect(monthlyValue(1020, 14, 21)).toBeCloseTo((1020 / 14) * (30 / 21));
    expect(monthlyValue(0, 0, null)).toBe(0);
  });
});
