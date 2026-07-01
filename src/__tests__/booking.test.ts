import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockBarbershopFindUnique,
  mockServiceFindMany,
  mockBarberFindUnique,
  mockUserFindFirst,
  mockUserFindUnique,
  mockUserCreate,
  mockAppointmentFindFirst,
  mockAppointmentCreate,
  mockSubscriptionFindUnique,
  mockSubscriptionFindFirst,
  mockSendWhatsAppNotification,
} = vi.hoisted(() => ({
  mockBarbershopFindUnique: vi.fn(),
  mockServiceFindMany: vi.fn(),
  mockBarberFindUnique: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockAppointmentFindFirst: vi.fn(),
  mockAppointmentCreate: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockSubscriptionFindFirst: vi.fn(),
  mockSendWhatsAppNotification: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    barbershop: { findUnique: mockBarbershopFindUnique },
    service: { findMany: mockServiceFindMany },
    barber: { findUnique: mockBarberFindUnique },
    user: {
      findFirst: mockUserFindFirst,
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
    },
    appointment: {
      findFirst: mockAppointmentFindFirst,
      create: mockAppointmentCreate,
    },
    subscription: {
      findUnique: mockSubscriptionFindUnique,
      findFirst: mockSubscriptionFindFirst,
    },
  },
}));

// Paywall isolado deste teste: a barbearia sempre tem acesso liberado.
vi.mock("@/lib/entitlements", () => ({
  getEntitlements: vi.fn().mockReturnValue({ hasAccess: true, hasAI: false, reason: null }),
}));
vi.mock("@/lib/notifications", () => ({
  sendWhatsAppNotification: mockSendWhatsAppNotification,
}));

vi.mock("@/lib/zapi", () => ({ sendWhatsApp: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({ sendAppointmentConfirmation: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/ratelimit", () => ({
  bookingRatelimit: { limit: vi.fn().mockResolvedValue({ success: true }) },
  getIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$mocked"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

import { POST } from "@/app/api/booking/[slug]/book/route";

const SHOP = { id: "shop-1", name: "Barber Master", slug: "barber-master" };
const SERVICE = { id: "svc-1", name: "Corte", price: 30, duration: 30 };
const BARBER = {
  id: "barb-1",
  barbershopId: "shop-1",
  user: { name: "Eduardo", phone: "11999990000" },
};
const NEW_CLIENT = {
  id: "client-new",
  name: "Carlos Silva",
  email: "11988887777@cliente.iadebarbearia.com",
  phone: "11988887777",
};
const CREATED_APPOINTMENT = {
  id: "appt-1",
  date: new Date("2026-06-10"),
  startTime: "10:00",
  endTime: "10:30",
};

const VALID_BODY = {
  clientName: "Carlos Silva",
  clientPhone: "11988887777",
  barberId: "barb-1",
  serviceId: "svc-1",
  date: "2026-06-10",
  startTime: "10:00",
};

function makeBookRequest(body: object) {
  return new NextRequest("http://localhost/api/booking/barber-master/book", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function withSlug(slug = "barber-master") {
  return { params: Promise.resolve({ slug }) };
}

describe("POST /api/booking/[slug]/book", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBarbershopFindUnique.mockResolvedValue(SHOP);
    mockServiceFindMany.mockResolvedValue([SERVICE]);
    mockBarberFindUnique.mockResolvedValue(BARBER);
    mockUserFindFirst.mockResolvedValue(null);      // cliente novo
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(NEW_CLIENT);
    mockAppointmentFindFirst.mockResolvedValue(null);
    mockAppointmentCreate.mockResolvedValue(CREATED_APPOINTMENT);
    mockSubscriptionFindUnique.mockResolvedValue(null);
    mockSubscriptionFindFirst.mockResolvedValue(null);  // sem assinatura em atraso
    mockSendWhatsAppNotification.mockResolvedValue({ success: true });
  });

  it("cria agendamento e novo cliente quando telefone não está no banco", async () => {
    const res = await POST(makeBookRequest(VALID_BODY), withSlug());
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.message).toBe("Agendamento confirmado!");
    expect(data.appointment).toBeDefined();
    expect(mockUserCreate).toHaveBeenCalledOnce();
    expect(mockAppointmentCreate).toHaveBeenCalledOnce();
  });

  it("reutiliza cliente existente sem criar novo registro", async () => {
    // cliente existe mas sem agendamento futuro
    mockUserFindFirst.mockResolvedValueOnce({ ...NEW_CLIENT, role: "CLIENT" });
    // nome diferente → não dispara double-booking check
    mockUserFindFirst.mockResolvedValue(null);

    const bodyOutroNome = { ...VALID_BODY, clientName: "Carlos Diferente" };
    const res = await POST(makeBookRequest(bodyOutroNome), withSlug());

    expect(res.status).toBe(201);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("bloqueia double-booking: 409 quando cliente já tem agendamento futuro ativo", async () => {
    const existingClient = { ...NEW_CLIENT, role: "CLIENT" };
    mockUserFindFirst.mockResolvedValue(existingClient);
    mockAppointmentFindFirst.mockResolvedValue({
      date: new Date("2026-06-15"),
      startTime: "14:00",
    });

    const res = await POST(makeBookRequest(VALID_BODY), withSlug());
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toMatch(/já tem um agendamento/);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  it("assinante não é bloqueado pelo double-booking mesmo com agendamento futuro", async () => {
    const existingClient = { ...NEW_CLIENT, role: "CLIENT" };
    mockUserFindFirst.mockResolvedValue(existingClient);
    // mesmo que haja appointment futuro, assinante é isento
    mockAppointmentFindFirst.mockResolvedValue({
      date: new Date("2026-06-15"),
      startTime: "14:00",
    });

    const bodyComSub = { ...VALID_BODY, subscriptionId: "sub-123" };
    const res = await POST(makeBookRequest(bodyComSub), withSlug());

    expect(res.status).toBe(201);
  });

  it("bloqueia inadimplente com 403 quando blockOverdueEnabled está ligado", async () => {
    mockBarbershopFindUnique.mockResolvedValue({ ...SHOP, blockOverdueEnabled: true });
    mockUserFindFirst.mockResolvedValue({ ...NEW_CLIENT, role: "CLIENT" });
    // cliente possui assinatura em atraso (OVERDUE)
    mockSubscriptionFindFirst.mockResolvedValue({ id: "sub-overdue", plan: { name: "Plano Ouro" } });

    const res = await POST(makeBookRequest(VALID_BODY), withSlug());
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe("SUBSCRIPTION_OVERDUE");
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
    // avisa o cliente por WhatsApp que está em atraso
    expect(mockSendWhatsAppNotification).toHaveBeenCalledOnce();
  });

  it("com blockOverdueEnabled desligado, inadimplente ainda agenda (como avulso)", async () => {
    // flag off (SHOP padrão) — o gate nem consulta a assinatura
    mockUserFindFirst.mockResolvedValue({ ...NEW_CLIENT, role: "CLIENT" });
    mockSubscriptionFindFirst.mockResolvedValue({ id: "sub-overdue" });

    const res = await POST(makeBookRequest(VALID_BODY), withSlug());

    expect(res.status).toBe(201);
    expect(mockSubscriptionFindFirst).not.toHaveBeenCalled();
    expect(mockAppointmentCreate).toHaveBeenCalledOnce();
  });

  it("retorna 404 quando barbearia não existe", async () => {
    mockBarbershopFindUnique.mockResolvedValue(null);

    const res = await POST(makeBookRequest(VALID_BODY), withSlug("inexistente"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Barbearia não encontrada");
  });

  it("retorna 404 quando serviço não existe", async () => {
    mockServiceFindMany.mockResolvedValue([]);

    const res = await POST(makeBookRequest(VALID_BODY), withSlug());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Serviço inválido");
  });
});
