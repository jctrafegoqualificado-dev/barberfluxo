import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { poolOf } from "@/lib/commissions";

describe("pote das assinaturas", () => {
  it("exemplo do dono: 100 assinantes × R$ 70, 400 atendimentos, 50/50", () => {
    const p = poolOf(7000, 400, { poeOwnerPct: 50, poeDeductFees: false, poeSubscriptionFee: 0 });
    expect(p.shopPart).toBe(3500);
    expect(p.barbersPart).toBe(3500);
    expect(p.ticket).toBe(8.75);
    // quem fez 100 atendimentos recebe 100 × 8,75
    expect(p.ticket * 100).toBe(875);
  });
  it("sem configuração usa 50/50 sem taxa (a regra de sempre)", () => {
    const p = poolOf(7000, 400, null);
    expect(p.barbersPart).toBe(3500);
    expect(p.fees).toBe(0);
  });
  it("taxa do cartão sai antes de dividir, quando marcada", () => {
    const p = poolOf(1000, 10, { poeOwnerPct: 50, poeDeductFees: true, poeSubscriptionFee: 5 });
    expect(p.fees).toBe(50);
    expect(p.barbersPart).toBe(475);
    expect(p.ticket).toBe(47.5);
  });
  it("taxa configurada mas desmarcada não desconta", () => {
    expect(poolOf(1000, 10, { poeOwnerPct: 50, poeDeductFees: false, poeSubscriptionFee: 5 }).fees).toBe(0);
  });
  it("sem atendimentos de assinante o valor por atendimento é zero", () => {
    expect(poolOf(1000, 0, null).ticket).toBe(0);
  });
});

describe("plano com comissão própria fica fora do pote", async () => {
  const { poolRevenue, poolServices } = await import("@/lib/commissions");
  const own = { subscription: { plan: { commissionPercentage: 35 } } };
  const normal = { subscription: { plan: { commissionPercentage: null } } };
  it("o dinheiro dele não entra no pote", () => {
    expect(poolRevenue([{ amount: 120, ...normal }, { amount: 189, ...own }, { amount: 100 }])).toBe(220);
  });
  it("os atendimentos dele não dividem o pote", () => {
    const svc = { price: 45, service: { id: "c", name: "Corte" }, services: [] };
    expect(poolServices([{ ...svc, ...normal }, { ...svc, ...own }, { ...svc, ...normal }])).toBe(2);
  });
});
