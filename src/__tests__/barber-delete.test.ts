import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockRequireAuth,
  mockBarberFindFirst,
  mockBarberUpdate,
  mockBarberDelete,
  mockAppointmentCount,
  mockProductSaleCount,
  mockCommissionPaymentCount,
  mockCommissionValeCount,
  mockReviewCount,
  mockBarbershopCount,
  mockSubscriptionCount,
  mockWhatsAppContactCount,
  mockLoyaltyPointCount,
  mockClientRetentionCount,
  mockScheduleBlockDeleteMany,
  mockTaskUpdateMany,
  mockMetaUpdateMany,
  mockUserDelete,
  mockUserUpdateMany,
  mockTransaction,
  mockLogAudit,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockBarberFindFirst: vi.fn(),
  mockBarberUpdate: vi.fn(),
  mockBarberDelete: vi.fn(),
  mockAppointmentCount: vi.fn(),
  mockProductSaleCount: vi.fn(),
  mockCommissionPaymentCount: vi.fn(),
  mockCommissionValeCount: vi.fn(),
  mockReviewCount: vi.fn(),
  mockBarbershopCount: vi.fn(),
  mockSubscriptionCount: vi.fn(),
  mockWhatsAppContactCount: vi.fn(),
  mockLoyaltyPointCount: vi.fn(),
  mockClientRetentionCount: vi.fn(),
  mockScheduleBlockDeleteMany: vi.fn(),
  mockTaskUpdateMany: vi.fn(),
  mockMetaUpdateMany: vi.fn(),
  mockUserDelete: vi.fn(),
  mockUserUpdateMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockLogAudit: vi.fn(),
}));

const tx = {
  scheduleBlock: { deleteMany: mockScheduleBlockDeleteMany },
  task: { updateMany: mockTaskUpdateMany },
  meta: { updateMany: mockMetaUpdateMany },
  barber: { update: mockBarberUpdate, delete: mockBarberDelete },
  user: { delete: mockUserDelete, updateMany: mockUserUpdateMany },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    // A rota usa $transaction nas DUAS formas: array (as contagens) e callback
    // (o hard delete). O mock precisa aceitar as duas.
    $transaction: mockTransaction,
    barber: { findFirst: mockBarberFindFirst, update: mockBarberUpdate, delete: mockBarberDelete },
    appointment: { count: mockAppointmentCount },
    productSale: { count: mockProductSaleCount },
    commissionPayment: { count: mockCommissionPaymentCount },
    commissionVale: { count: mockCommissionValeCount },
    review: { count: mockReviewCount },
    barbershop: { count: mockBarbershopCount },
    subscription: { count: mockSubscriptionCount },
    whatsAppContact: { count: mockWhatsAppContactCount },
    loyaltyPoint: { count: mockLoyaltyPointCount },
    clientRetention: { count: mockClientRetentionCount },
    scheduleBlock: { deleteMany: mockScheduleBlockDeleteMany },
    task: { updateMany: mockTaskUpdateMany },
    meta: { updateMany: mockMetaUpdateMany },
    user: { delete: mockUserDelete, updateMany: mockUserUpdateMany },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuth,
  hashPassword: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { DELETE } from "@/app/api/barbershop/barbers/route";

const SHOP = "shop_1";
const BARBER = {
  id: "barber_1",
  userId: "user_barbeiro",
  user: { name: "Roberto", email: "roberto@x.com", role: "BARBER", isPlatformAdmin: false },
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/barbershop/barbers", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Zera todos os contadores de histórico e de vínculos do usuário. */
function semNada() {
  mockAppointmentCount.mockResolvedValue(0);
  mockProductSaleCount.mockResolvedValue(0);
  mockCommissionPaymentCount.mockResolvedValue(0);
  mockCommissionValeCount.mockResolvedValue(0);
  mockReviewCount.mockResolvedValue(0);
  mockBarbershopCount.mockResolvedValue(0);
  mockSubscriptionCount.mockResolvedValue(0);
  mockWhatsAppContactCount.mockResolvedValue(0);
  mockLoyaltyPointCount.mockResolvedValue(0);
  mockClientRetentionCount.mockResolvedValue(0);
}

describe("DELETE /api/barbershop/barbers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockReturnValue({
      id: "user_dono", email: "dono@x.com", role: "OWNER", barbershopId: SHOP,
    });
    mockBarberFindFirst.mockResolvedValue(BARBER);
    semNada();
    // Array → resolve as promessas; callback → executa com o tx falso.
    mockTransaction.mockImplementation((arg: unknown) =>
      typeof arg === "function" ? (arg as (t: unknown) => unknown)(tx) : Promise.all(arg as Promise<unknown>[])
    );
  });

  describe("sem histórico → apaga de vez", () => {
    it("apaga o perfil e responde mode=deleted", async () => {
      const res = await DELETE(makeRequest({ barberId: "barber_1" }));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, mode: "deleted" });
      expect(mockBarberDelete).toHaveBeenCalledOnce();
      expect(mockBarberUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { allowedPlans: { set: [] } } })
      );
    });

    it("apaga também a conta quando ela não tem nenhum outro vínculo", async () => {
      await DELETE(makeRequest({ barberId: "barber_1" }));
      expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: "user_barbeiro" } });
      expect(mockUserUpdateMany).not.toHaveBeenCalled();
    });

    it("preserva a conta que também é cliente, rebaixando BARBER para CLIENT", async () => {
      mockAppointmentCount.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve("clientId" in where ? 7 : 0)   // 7 atendimentos como CLIENTE
      );
      const res = await DELETE(makeRequest({ barberId: "barber_1" }));
      expect(res.status).toBe(200);
      expect(mockUserDelete).not.toHaveBeenCalled();
      expect(mockUserUpdateMany).toHaveBeenCalledWith({
        where: { id: "user_barbeiro", role: "BARBER" },
        data: { role: "CLIENT" },
      });
    });

    it("nunca apaga a conta de um PLATFORM_ADMIN", async () => {
      mockBarberFindFirst.mockResolvedValue({
        ...BARBER,
        user: { ...BARBER.user, role: "PLATFORM_ADMIN", isPlatformAdmin: true },
      });
      await DELETE(makeRequest({ barberId: "barber_1" }));
      expect(mockBarberDelete).toHaveBeenCalledOnce();
      expect(mockUserDelete).not.toHaveBeenCalled();
    });

    it("desatribui tarefas e metas em vez de apagá-las junto", async () => {
      await DELETE(makeRequest({ barberId: "barber_1" }));
      expect(mockTaskUpdateMany).toHaveBeenCalledWith({
        where: { barberId: "barber_1" }, data: { barberId: null },
      });
      expect(mockMetaUpdateMany).toHaveBeenCalledWith({
        where: { barberId: "barber_1" }, data: { barberId: null },
      });
      expect(mockScheduleBlockDeleteMany).toHaveBeenCalledOnce();
    });
  });

  describe("com histórico → arquiva", () => {
    it("arquiva em vez de apagar, preservando o histórico financeiro", async () => {
      mockCommissionPaymentCount.mockResolvedValue(3);
      const res = await DELETE(makeRequest({ barberId: "barber_1" }));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, mode: "archived" });
      expect(mockBarberDelete).not.toHaveBeenCalled();
      expect(mockUserDelete).not.toHaveBeenCalled();
      const data = mockBarberUpdate.mock.calls[0][0].data;
      expect(data.active).toBe(false);
      expect(data.onVacation).toBe(false);
      expect(data.archivedAt).toBeInstanceOf(Date);
    });

    it("um único atendimento passado já basta para arquivar", async () => {
      mockAppointmentCount.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve("status" in where ? 0 : 1)  // nenhum futuro, 1 no total
      );
      const res = await DELETE(makeRequest({ barberId: "barber_1" }));
      expect((await res.json()).mode).toBe("archived");
    });
  });

  describe("recusas", () => {
    it("recusa com 409 quando há agendamentos futuros", async () => {
      // A consulta de futuros filtra por status; a de histórico não.
      mockAppointmentCount.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve("status" in where ? 15 : 900)
      );
      const res = await DELETE(makeRequest({ barberId: "barber_1" }));
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.upcomingAppointments).toBe(15);
      expect(body.error).toContain("15");
      expect(mockBarberDelete).not.toHaveBeenCalled();
      expect(mockBarberUpdate).not.toHaveBeenCalled();
    });

    it("impede o dono de excluir o próprio perfil", async () => {
      mockBarberFindFirst.mockResolvedValue({ ...BARBER, userId: "user_dono" });
      const res = await DELETE(makeRequest({ barberId: "barber_1" }));
      expect(res.status).toBe(400);
      expect(mockBarberDelete).not.toHaveBeenCalled();
    });

    it("não encontra barbeiro de outra barbearia (isolamento por tenant)", async () => {
      mockBarberFindFirst.mockResolvedValue(null);
      const res = await DELETE(makeRequest({ barberId: "barber_de_outra" }));
      expect(res.status).toBe(404);
      // A consulta precisa ter sido escopada pela barbearia do token.
      expect(mockBarberFindFirst.mock.calls[0][0].where.barbershopId).toBe(SHOP);
    });

    it("exige barberId", async () => {
      const res = await DELETE(makeRequest({}));
      expect(res.status).toBe(400);
    });

    it("responde 401 quando o token não autoriza", async () => {
      mockRequireAuth.mockImplementation(() => { throw new Error("UNAUTHORIZED"); });
      const res = await DELETE(makeRequest({ barberId: "barber_1" }));
      expect(res.status).toBe(401);
    });
  });

  it("registra DELETE ou ARCHIVE na auditoria conforme o caminho", async () => {
    await DELETE(makeRequest({ barberId: "barber_1" }));
    expect(mockLogAudit.mock.calls[0][0].action).toBe("DELETE");

    vi.clearAllMocks();
    mockRequireAuth.mockReturnValue({ id: "user_dono", email: "dono@x.com", role: "OWNER", barbershopId: SHOP });
    mockBarberFindFirst.mockResolvedValue(BARBER);
    semNada();
    mockTransaction.mockImplementation((arg: unknown) =>
      typeof arg === "function" ? (arg as (t: unknown) => unknown)(tx) : Promise.all(arg as Promise<unknown>[])
    );
    mockReviewCount.mockResolvedValue(2);
    await DELETE(makeRequest({ barberId: "barber_1" }));
    expect(mockLogAudit.mock.calls[0][0].action).toBe("ARCHIVE");
  });
});
