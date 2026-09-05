import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAppointmentFindMany } = vi.hoisted(() => ({
  mockAppointmentFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { appointment: { findMany: mockAppointmentFindMany } },
}));

import { findClientOverlap, clientOverlapMessage, toMinutes, toHHMM } from "@/lib/appointments";

const BASE = {
  clientId: "cli_1",
  barbershopId: "shop_1",
  date: new Date("2026-09-10T12:00:00Z"),
};

function existing(startTime: string, endTime: string, barberName = "Adrian") {
  return {
    id: "appt_existente",
    startTime,
    endTime,
    barber: { nickname: null, user: { name: barberName } },
  };
}

describe("findClientOverlap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppointmentFindMany.mockResolvedValue([]);
  });

  it("não acusa nada quando o cliente não tem outro agendamento no dia", async () => {
    const r = await findClientOverlap({ ...BASE, startTime: "14:00", endTime: "14:45" });
    expect(r).toBeNull();
  });

  it("bloqueia horário idêntico com outro barbeiro — o caso relatado em produção", async () => {
    mockAppointmentFindMany.mockResolvedValue([existing("14:00", "14:45", "Matheus")]);
    const r = await findClientOverlap({ ...BASE, startTime: "14:00", endTime: "14:45" });
    expect(r).not.toBeNull();
    expect(r!.barberName).toBe("Matheus");
  });

  it("bloqueia sobreposição parcial (começa no meio do outro)", async () => {
    mockAppointmentFindMany.mockResolvedValue([existing("14:00", "15:00")]);
    const r = await findClientOverlap({ ...BASE, startTime: "14:30", endTime: "15:15" });
    expect(r).not.toBeNull();
  });

  it("bloqueia quando o novo horário engloba o existente", async () => {
    mockAppointmentFindMany.mockResolvedValue([existing("14:15", "14:30")]);
    const r = await findClientOverlap({ ...BASE, startTime: "14:00", endTime: "15:00" });
    expect(r).not.toBeNull();
  });

  it("libera horários encostados: um termina exatamente quando o outro começa", async () => {
    mockAppointmentFindMany.mockResolvedValue([existing("14:00", "14:45")]);
    const r = await findClientOverlap({ ...BASE, startTime: "14:45", endTime: "15:30" });
    expect(r).toBeNull();
  });

  it("libera outro horário no mesmo dia sem sobreposição", async () => {
    mockAppointmentFindMany.mockResolvedValue([existing("09:00", "09:45")]);
    const r = await findClientOverlap({ ...BASE, startTime: "16:00", endTime: "16:45" });
    expect(r).toBeNull();
  });

  it("ignora CANCELLED e NO_SHOW na consulta — o cliente não está ocupado neles", async () => {
    await findClientOverlap({ ...BASE, startTime: "14:00", endTime: "14:45" });
    const where = mockAppointmentFindMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ notIn: ["CANCELLED", "NO_SHOW"] });
  });

  it("ao remarcar, não conflita com o próprio agendamento", async () => {
    await findClientOverlap({
      ...BASE,
      startTime: "14:00",
      endTime: "14:45",
      excludeAppointmentId: "appt_atual",
    });
    const where = mockAppointmentFindMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ not: "appt_atual" });
  });

  it("escopo é o cliente e a barbearia, não o barbeiro", async () => {
    await findClientOverlap({ ...BASE, startTime: "14:00", endTime: "14:45" });
    const where = mockAppointmentFindMany.mock.calls[0][0].where;
    expect(where.clientId).toBe("cli_1");
    expect(where.barbershopId).toBe("shop_1");
    expect(where).not.toHaveProperty("barberId");
  });

  it("prefere o apelido do barbeiro na mensagem, quando existe", async () => {
    mockAppointmentFindMany.mockResolvedValue([
      { id: "a1", startTime: "14:00", endTime: "14:45", barber: { nickname: "Cubano", user: { name: "Adrian Garrido" } } },
    ]);
    const r = await findClientOverlap({ ...BASE, startTime: "14:00", endTime: "14:45" });
    expect(clientOverlapMessage(r!)).toContain("Cubano");
    expect(clientOverlapMessage(r!)).toContain("14:00");
  });
});

describe("conversão de horário", () => {
  it("converte ida e volta sem perder valor", () => {
    for (const t of ["00:00", "09:15", "14:45", "23:59"]) {
      expect(toHHMM(toMinutes(t))).toBe(t);
    }
  });
});
