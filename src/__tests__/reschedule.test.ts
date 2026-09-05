import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockAppointmentFindUnique,
  mockAppointmentFindFirst,
  mockAppointmentFindMany,
  mockAppointmentUpdate,
  mockRequireAuth,
  mockLogAudit,
  mockNotifyBarberMoved,
  mockSendWhatsAppNotification,
} = vi.hoisted(() => ({
  mockAppointmentFindUnique: vi.fn(),
  mockAppointmentFindFirst: vi.fn(),
  mockAppointmentFindMany: vi.fn(),
  mockAppointmentUpdate: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockLogAudit: vi.fn(),
  mockNotifyBarberMoved: vi.fn(),
  mockSendWhatsAppNotification: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: {
      findUnique: mockAppointmentFindUnique,
      findFirst: mockAppointmentFindFirst,
      findMany: mockAppointmentFindMany,
      update: mockAppointmentUpdate,
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  requireActiveSubscription: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/notifications", () => ({
  sendWhatsAppNotification: mockSendWhatsAppNotification,
  notifyBarberNewAppointment: vi.fn(),
  notifyBarberAppointmentMoved: mockNotifyBarberMoved,
  welcomeMessage: vi.fn(),
}));

vi.mock("@/lib/phone", () => ({
  onlyDigits: (s: string) => s.replace(/\D/g, ""),
  phoneVariants: (s: string) => [s],
}));

import { PATCH } from "@/app/api/barbershop/appointments/route";

const SHOP_ID = "shop_1";

const CURRENT = {
  id: "appt_1",
  barbershopId: SHOP_ID,
  barberId: "barber_A",
  clientId: "cli_1",
  date: new Date("2026-09-10T12:00:00Z"),
  startTime: "14:15",
  endTime: "15:00",
  client: { name: "Cristiano Fidelis", phone: "41999999999" },
  barbershop: { name: "Lord of Barba" },
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/barbershop/appointments", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/barbershop/appointments — remarcação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockReturnValue({
      id: "user_dono", email: "dono@x.com", role: "OWNER", barbershopId: SHOP_ID,
    });
    mockAppointmentFindUnique.mockResolvedValue(CURRENT);
    mockAppointmentFindFirst.mockResolvedValue(null); // barbeiro livre
    mockAppointmentFindMany.mockResolvedValue([]);    // cliente sem sobreposição
    mockAppointmentUpdate.mockResolvedValue({ ...CURRENT, startTime: "15:00" });
    // A rota encadeia .catch() no envio — o mock precisa devolver promessa.
    mockSendWhatsAppNotification.mockResolvedValue({ success: true });
  });

  it("move o agendamento e preserva a duração original", async () => {
    const res = await PATCH(makeRequest({ id: "appt_1", startTime: "15:00" }));
    expect(res.status).toBe(200);
    expect(mockAppointmentUpdate).toHaveBeenCalledOnce();
    const data = mockAppointmentUpdate.mock.calls[0][0].data;
    expect(data.startTime).toBe("15:00");
    expect(data.endTime).toBe("15:45"); // 45 min preservados
  });

  it("avisa o barbeiro — a lacuna que gerava 'a confirmação diz um horário, a agenda mostra outro'", async () => {
    await PATCH(makeRequest({ id: "appt_1", startTime: "15:00" }));
    expect(mockNotifyBarberMoved).toHaveBeenCalledOnce();
    const arg = mockNotifyBarberMoved.mock.calls[0][0];
    expect(arg.fromStartTime).toBe("14:15");
    expect(arg.toStartTime).toBe("15:00");
    expect(arg.changedByUserId).toBe("user_dono");
  });

  it("continua avisando o cliente", async () => {
    await PATCH(makeRequest({ id: "appt_1", startTime: "15:00" }));
    expect(mockSendWhatsAppNotification).toHaveBeenCalledOnce();
  });

  it("registra a mudança na auditoria, com horário antes e depois", async () => {
    await PATCH(makeRequest({ id: "appt_1", startTime: "15:00" }));
    expect(mockLogAudit).toHaveBeenCalledOnce();
    const entry = mockLogAudit.mock.calls[0][0];
    expect(entry.action).toBe("UPDATE");
    expect(entry.entity).toBe("Appointment");
    expect(entry.diff.before.startTime).toBe("14:15");
    expect(entry.diff.after.startTime).toBe("15:00");
  });

  it("recusa quando o profissional já tem agendamento no destino", async () => {
    mockAppointmentFindFirst.mockResolvedValue({ id: "outro" });
    const res = await PATCH(makeRequest({ id: "appt_1", startTime: "15:00" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("CONFLICT");
    expect(mockAppointmentUpdate).not.toHaveBeenCalled();
    expect(mockSendWhatsAppNotification).not.toHaveBeenCalled();
  });

  it("recusa quando cria sobreposição para o próprio cliente com outro barbeiro", async () => {
    mockAppointmentFindMany.mockResolvedValue([
      { id: "appt_2", startTime: "15:00", endTime: "15:45", barber: { nickname: null, user: { name: "Matheus" } } },
    ]);
    const res = await PATCH(makeRequest({ id: "appt_1", startTime: "15:00" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("CLIENT_OVERLAP");
    expect(body.message).toContain("Matheus");
    expect(mockAppointmentUpdate).not.toHaveBeenCalled();
  });

  it("não conflita consigo mesmo ao remarcar", async () => {
    await PATCH(makeRequest({ id: "appt_1", startTime: "15:00" }));
    const where = mockAppointmentFindMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ not: "appt_1" });
  });

  it("com force, move mesmo havendo conflito e sem consultar as travas", async () => {
    mockAppointmentFindFirst.mockResolvedValue({ id: "outro" });
    const res = await PATCH(makeRequest({ id: "appt_1", startTime: "15:00", force: true }));
    expect(res.status).toBe(200);
    expect(mockAppointmentFindFirst).not.toHaveBeenCalled();
    expect(mockAppointmentUpdate).toHaveBeenCalledOnce();
  });

  it("não deixa mexer em agendamento de outra barbearia", async () => {
    mockAppointmentFindUnique.mockResolvedValue({ ...CURRENT, barbershopId: "outra_shop" });
    const res = await PATCH(makeRequest({ id: "appt_1", startTime: "15:00" }));
    expect(res.status).toBe(404);
    expect(mockAppointmentUpdate).not.toHaveBeenCalled();
  });
});
