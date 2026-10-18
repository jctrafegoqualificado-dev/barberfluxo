import { describe, it, expect } from "vitest";
import { appointmentStartsAt } from "@/lib/appointmentTime";

// Appointment.date é gravado assim pelo app: dia + T12:00:00Z
const day = (d: string) => new Date(`${d}T12:00:00Z`);

describe("appointmentStartsAt — horário do agendamento no fuso de São Paulo", () => {
  it("14:30 em SP é 17:30 UTC", () => {
    expect(appointmentStartsAt(day("2026-10-16"), "14:30").toISOString()).toBe("2026-10-16T17:30:00.000Z");
  });

  it("23:30 em SP já é o dia seguinte em UTC", () => {
    expect(appointmentStartsAt(day("2026-10-16"), "23:30").toISOString()).toBe("2026-10-17T02:30:00.000Z");
  });

  it("não depende do fuso do servidor", () => {
    const a = appointmentStartsAt(day("2026-12-31"), "09:00");
    expect(a.getTime()).toBe(Date.UTC(2026, 11, 31, 12, 0));
  });

  it("lembrete de 60 min para as 14:30 cai às 13:30 de SP", () => {
    const starts = appointmentStartsAt(day("2026-10-16"), "14:30");
    const reminder = new Date(starts.getTime() - 60 * 60 * 1000);
    expect(reminder.toISOString()).toBe("2026-10-16T16:30:00.000Z"); // 13:30 em SP
  });
});
