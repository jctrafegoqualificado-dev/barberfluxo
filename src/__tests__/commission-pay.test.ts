import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockBarberFindFirst, mockPayFindFirst, mockPayCreate, mockPayDeleteMany } = vi.hoisted(() => ({
  mockBarberFindFirst: vi.fn(),
  mockPayFindFirst: vi.fn(),
  mockPayCreate: vi.fn(),
  mockPayDeleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    barber: { findFirst: mockBarberFindFirst },
    commissionPayment: { findFirst: mockPayFindFirst, create: mockPayCreate, deleteMany: mockPayDeleteMany },
  },
}));
vi.mock("@/lib/auth", () => ({ requireAuth: () => ({ barbershopId: "shop-1", role: "OWNER" }) }));

import { POST, DELETE } from "@/app/api/barbershop/comissoes/pagar/route";
import { currentMonthSP, addMonth } from "@/lib/monthResult";

const req = (method: string, body: object) =>
  new NextRequest("http://localhost/api/barbershop/comissoes/pagar", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe("pagar comissão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBarberFindFirst.mockResolvedValue({ id: "b1" });
    mockPayFindFirst.mockResolvedValue(null);
    mockPayCreate.mockImplementation(({ data }) => Promise.resolve({ id: "p", ...data }));
  });

  it("avulsos: cada semana vira um pagamento novo no mesmo mês", async () => {
    const month = currentMonthSP();
    expect((await POST(req("POST", { barberId: "b1", month, amount: 300, type: "STANDARD" }))).status).toBe(201);
    expect((await POST(req("POST", { barberId: "b1", month, amount: 250, type: "STANDARD" }))).status).toBe(201);
    expect(mockPayCreate).toHaveBeenCalledTimes(2);
  });

  it("assinaturas do mês aberto não podem ser pagas", async () => {
    const res = await POST(req("POST", { barberId: "b1", month: currentMonthSP(), amount: 500, type: "SUBSCRIPTION" }));
    expect(res.status).toBe(400);
    expect(mockPayCreate).not.toHaveBeenCalled();
  });

  it("assinaturas de mês fechado podem ser pagas", async () => {
    const res = await POST(req("POST", { barberId: "b1", month: addMonth(currentMonthSP(), -1), amount: 500, type: "SUBSCRIPTION" }));
    expect(res.status).toBe(201);
  });

  it("período personalizado não aceita pagamento", async () => {
    const res = await POST(req("POST", { barberId: "b1", month: "2026-10-01_2026-10-15", amount: 100 }));
    expect(res.status).toBe(400);
  });

  it("clique duplo não registra duas vezes", async () => {
    mockPayFindFirst.mockResolvedValue({ id: "ja" });
    const res = await POST(req("POST", { barberId: "b1", month: currentMonthSP(), amount: 300 }));
    expect(res.status).toBe(200);
    expect(mockPayCreate).not.toHaveBeenCalled();
  });

  it("desfazer apaga só aquele pagamento, e só desta barbearia", async () => {
    mockPayDeleteMany.mockResolvedValue({ count: 1 });
    await DELETE(req("DELETE", { id: "p9" }));
    expect(mockPayDeleteMany).toHaveBeenCalledWith({ where: { id: "p9", barbershopId: "shop-1" } });
  });
});
