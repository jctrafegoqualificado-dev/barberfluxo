import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPaymentFindMany, mockAppointmentFindMany } = vi.hoisted(() => ({
  mockPaymentFindMany: vi.fn(),
  mockAppointmentFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payment: { findMany: mockPaymentFindMany },
    appointment: { findMany: mockAppointmentFindMany },
  },
}));

import { avulsoCommission, extraCommission, extraCount, poolForMonth } from "@/lib/commissions";
import { subscriptionCommission } from "@/lib/subscriptionServices";

const corte = { id: "corte", name: "Corte", price: 45, materialCost: 0, commission: null };
const barba = { id: "barba", name: "Barba", price: 35, materialCost: 0, commission: null };
const pigmento = { id: "pig", name: "Pigmentação", price: 40, materialCost: 0, commission: 60 };

describe("comissão do avulso por serviço (regras de 21/10/2026)", () => {
  it("comissão fixa vale por serviço: corte + barba com R$ 10 fixo = R$ 20", () => {
    const a = { price: 80, service: corte, services: [{ service: corte }, { service: barba }] };
    expect(avulsoCommission(a, { commissionType: "FIXED", commission: 10 })).toBe(20);
  });
  it("serviço com comissão própria usa a dele; o resto usa a do barbeiro", () => {
    const a = { price: 85, service: corte, services: [{ service: corte }, { service: pigmento }] };
    // corte 45 × 40% = 18 ; pigmentação 40 × 60% = 24
    expect(avulsoCommission(a, { commissionType: "PERCENTAGE", commission: 40 })).toBeCloseTo(42, 2);
  });
  it("desconto na comanda é dividido proporcionalmente entre os serviços", () => {
    const a = { price: 40, service: corte, services: [{ service: corte }, { service: barba }] }; // 50% off de 80
    expect(avulsoCommission(a, { commissionType: "PERCENTAGE", commission: 50 })).toBeCloseTo(20, 2);
  });
  it("atendimento antigo sem itens usa o serviço principal", () => {
    expect(avulsoCommission({ price: 45, service: corte }, { commissionType: "PERCENTAGE", commission: 40 })).toBeCloseTo(18, 2);
  });
});

describe("extra do assinante", () => {
  const plano = { planServices: [{ serviceId: "corte" }] };
  it("extra zerado (removido na comanda) não comissiona", () => {
    expect(extraCommission({ extraPrice: 0 }, { commissionType: "PERCENTAGE", commission: 40 })).toBe(0);
  });
  it("comissão fixa conta cada serviço extra", () => {
    const a = {
      subscriptionId: "s1", price: 0, extraPrice: 75, service: corte,
      services: [{ service: corte }, { service: barba }, { service: pigmento }],
      subscription: { plan: plano },
    };
    expect(extraCount(a)).toBe(2);
    expect(extraCommission(a, { commissionType: "FIXED", commission: 10 }, extraCount(a))).toBe(20);
  });
});

describe("plano com comissão própria", () => {
  it("paga a % sobre o preço normal dos serviços do plano (não mais R$ 0)", () => {
    const a = {
      price: 0, extraPrice: 0, service: corte,
      services: [{ service: corte }],
      subscription: { plan: { planServices: [{ serviceId: "corte" }], commissionPercentage: 40 } },
    };
    expect(subscriptionCommission(a, 999)).toBeCloseTo(18, 2);
  });
});

describe("pote do mês", () => {
  const cfg = { poeOwnerPct: 50, poeDeductFees: false, poeSubscriptionFee: 0 };
  const plan = (billingCycle: string) => ({ subscription: { plan: { commissionPercentage: null, billingCycle } } });
  const visit = (date: string) => ({
    date: new Date(date + "T15:00:00-03:00"), price: 0, extraPrice: 0, service: corte,
    services: [{ service: corte }],
    subscription: { plan: { planServices: [{ serviceId: "corte" }], commissionPercentage: null } },
  });
  beforeEach(() => vi.clearAllMocks());

  it("plano anual entra dividido por 12 meses", async () => {
    mockPaymentFindMany.mockResolvedValue([{ amount: 1200, paidAt: new Date("2026-01-10T12:00:00-03:00"), ...plan("YEARLY") }]);
    mockAppointmentFindMany.mockResolvedValue([visit("2026-01-15"), visit("2026-02-15"), visit("2026-03-15")]);
    const p = await poolForMonth("shop", "2026-03", cfg);
    expect(p.gross).toBeCloseTo(100, 2);
    expect(p.barbersPart).toBeCloseTo(50, 2);
  });

  it("plano trimestral entra dividido por 3 e acaba no 3º mês", async () => {
    mockPaymentFindMany.mockResolvedValue([{ amount: 300, paidAt: new Date("2026-01-10T12:00:00-03:00"), ...plan("QUARTERLY") }]);
    mockAppointmentFindMany.mockResolvedValue([visit("2026-04-15")]);
    expect((await poolForMonth("shop", "2026-03", cfg)).gross).toBeCloseTo(100, 2);
    expect((await poolForMonth("shop", "2026-04", cfg)).gross).toBe(0);
  });

  it("mês sem nenhum serviço de plano passa a parte dos barbeiros para o seguinte", async () => {
    mockPaymentFindMany.mockResolvedValue([
      { amount: 100, paidAt: new Date("2026-02-05T12:00:00-03:00"), ...plan("MONTHLY") },
      { amount: 100, paidAt: new Date("2026-03-05T12:00:00-03:00"), ...plan("MONTHLY") },
    ]);
    mockAppointmentFindMany.mockResolvedValue([visit("2026-01-20"), visit("2026-03-20")]);
    const p = await poolForMonth("shop", "2026-03", cfg);
    expect(p.carried).toBeCloseTo(50, 2);
    expect(p.barbersPart).toBeCloseTo(100, 2); // 50 de março + 50 vindos de fevereiro
    expect(p.ticket).toBeCloseTo(100, 2);
  });
});
