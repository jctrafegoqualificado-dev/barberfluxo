import { describe, it, expect } from "vitest";
import { barberWorkWindow, parseBarberHours, barberHoursLabel } from "@/lib/barberHours";

// Barbearia aberta das 09:00 às 21:00
const OPEN = 9 * 60;
const CLOSE = 21 * 60;

describe("barberWorkWindow", () => {
  it("sem horário próprio segue o horário da barbearia", () => {
    expect(barberWorkWindow(OPEN, CLOSE, {})).toEqual({ start: OPEN, end: CLOSE });
    expect(barberWorkWindow(OPEN, CLOSE, { workStart: null, workEnd: null })).toEqual({ start: OPEN, end: CLOSE });
  });

  it("com horário próprio restringe à janela do barbeiro", () => {
    expect(barberWorkWindow(OPEN, CLOSE, { workStart: "11:00", workEnd: "20:00" })).toEqual({ start: 660, end: 1200 });
  });

  it("nunca passa do horário da barbearia", () => {
    expect(barberWorkWindow(OPEN, CLOSE, { workStart: "07:00", workEnd: "23:00" })).toEqual({ start: OPEN, end: CLOSE });
  });

  it("dia em que a barbearia abre só fora do horário do barbeiro fica sem janela", () => {
    // Sábado das 08:00 às 10:00, barbeiro só a partir das 11:00
    const w = barberWorkWindow(8 * 60, 10 * 60, { workStart: "11:00", workEnd: "20:00" });
    expect(w.start).toBeGreaterThanOrEqual(w.end);
  });

  it("horário salvo inválido é ignorado em vez de fechar a agenda", () => {
    expect(barberWorkWindow(OPEN, CLOSE, { workStart: "11h", workEnd: "20:00" })).toEqual({ start: OPEN, end: CLOSE });
  });
});

describe("parseBarberHours", () => {
  it("vazio volta para o horário da barbearia", () => {
    expect(parseBarberHours("", "")).toEqual({ ok: true, workStart: null, workEnd: null });
    expect(parseBarberHours(undefined, null)).toEqual({ ok: true, workStart: null, workEnd: null });
  });

  it("aceita um horário válido", () => {
    expect(parseBarberHours("11:00", "20:00")).toEqual({ ok: true, workStart: "11:00", workEnd: "20:00" });
  });

  it("recusa só um dos lados preenchido", () => {
    expect(parseBarberHours("11:00", "").ok).toBe(false);
  });

  it("recusa fim antes do início e formato inválido", () => {
    expect(parseBarberHours("20:00", "11:00").ok).toBe(false);
    expect(parseBarberHours("11:00", "11:00").ok).toBe(false);
    expect(parseBarberHours("25:00", "26:00").ok).toBe(false);
  });
});

describe("barberHoursLabel", () => {
  it("monta o texto ou devolve null", () => {
    expect(barberHoursLabel({ workStart: "11:00", workEnd: "20:00" })).toBe("11:00 às 20:00");
    expect(barberHoursLabel({})).toBeNull();
  });
});
