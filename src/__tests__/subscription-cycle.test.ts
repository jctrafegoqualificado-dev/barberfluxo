import { describe, it, expect } from "vitest";
import { advanceDue, monthlyValue, subState, dueKey, todayKeySP, daysBetween } from "@/lib/subscriptionCycle";

describe("advanceDue", () => {
  it("mensal anda 1 mês e mantém o dia fixo", () => {
    expect(dueKey(advanceDue("2026-10-16T00:00:00Z", 16, "MONTHLY"))).toBe("2026-11-16");
  });
  it("trimestral anda 3 meses e anual 12", () => {
    expect(dueKey(advanceDue("2026-10-16T00:00:00Z", 16, "QUARTERLY"))).toBe("2027-01-16");
    expect(dueKey(advanceDue("2026-10-16T00:00:00Z", 16, "YEARLY"))).toBe("2027-10-16");
  });
  it("dia 31 vira o último dia do mês e volta para 31 depois", () => {
    expect(dueKey(advanceDue("2026-01-31T00:00:00Z", 31, "MONTHLY"))).toBe("2026-02-28");
    expect(dueKey(advanceDue("2026-02-28T00:00:00Z", 31, "MONTHLY"))).toBe("2026-03-31");
  });
  it("vencimento gravado às 03:00 UTC (servidor local) cai no mesmo dia", () => {
    expect(dueKey(advanceDue("2026-10-16T03:00:00Z", 16, "MONTHLY"))).toBe("2026-11-16");
  });
  it("desfazer volta 1 ciclo", () => {
    expect(dueKey(advanceDue("2027-01-16T12:00:00Z", 16, "QUARTERLY", -1))).toBe("2026-10-16");
  });
});

describe("monthlyValue", () => {
  it("converte trimestral e anual para o valor por mês", () => {
    expect(monthlyValue(300, "QUARTERLY")).toBe(100);
    expect(monthlyValue(1200, "YEARLY")).toBe(100);
    expect(monthlyValue(89, "MONTHLY")).toBe(89);
  });
});

describe("subState", () => {
  const today = "2026-10-17";
  it("vence hoje", () => {
    expect(subState({ status: "ACTIVE", nextBillingDate: "2026-10-17T00:00:00Z" }, today).state).toBe("today");
  });
  it("venceu ontem = atrasado 1 dia (mesmo ainda ACTIVE)", () => {
    expect(subState({ status: "ACTIVE", nextBillingDate: "2026-10-16T00:00:00Z" }, today)).toEqual({ state: "late", lateDays: 1 });
  });
  it("cartão recusado passa na frente do atraso", () => {
    expect(subState({ status: "OVERDUE", nextBillingDate: "2026-10-10T00:00:00Z", authorizationStatus: "FAILED" }, today).state).toBe("failed");
  });
  it("pausado e cancelado ignoram o vencimento", () => {
    expect(subState({ status: "PAUSED", nextBillingDate: "2026-01-01T00:00:00Z" }, today).state).toBe("paused");
    expect(subState({ status: "CANCELLED", nextBillingDate: "2026-01-01T00:00:00Z" }, today).state).toBe("cancelled");
  });
  it("link de débito automático ainda não autorizado", () => {
    expect(subState({ status: "ACTIVE", nextBillingDate: "2026-11-01T00:00:00Z", authorizationStatus: "PENDING_AUTH" }, today).state).toBe("auth");
  });
  it("em dia", () => {
    expect(subState({ status: "ACTIVE", nextBillingDate: "2026-11-01T00:00:00Z", authorizationStatus: "AUTHORIZED" }, today).state).toBe("ok");
  });
});

describe("todayKeySP", () => {
  it("23h em São Paulo ainda é o mesmo dia (02h UTC do dia seguinte)", () => {
    expect(todayKeySP(new Date("2026-10-18T02:00:00Z"))).toBe("2026-10-17");
  });
  it("daysBetween", () => {
    expect(daysBetween("2026-10-10", "2026-10-17")).toBe(7);
  });
});
