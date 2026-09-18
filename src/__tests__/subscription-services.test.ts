import { describe, it, expect } from "vitest";
import {
  countPlanServices,
  planServicesLabel,
  subscriptionCommission,
  totalPlanServices,
  type SubscriptionAppt,
} from "@/lib/subscriptionServices";

const corte = { id: "corte", name: "Corte", materialCost: 2 };
const barba = { id: "barba", name: "Barba", materialCost: 3 };
const sobrancelha = { id: "sobrancelha", name: "Sobrancelha", materialCost: 0 };

const planoCorteBarba = { planServices: [{ serviceId: "corte" }, { serviceId: "barba" }] };

function appt(services: typeof corte[], extra: Partial<SubscriptionAppt> = {}): SubscriptionAppt {
  return {
    price: 80,
    extraPrice: 0,
    service: services[0] ?? null,
    services: services.map((service) => ({ service })),
    subscription: { plan: planoCorteBarba },
    ...extra,
  };
}

describe("contagem de serviços de assinante", () => {
  it("Corte + Barba do plano conta 2 serviços", () => {
    expect(countPlanServices(appt([corte, barba]))).toBe(2);
    expect(planServicesLabel(appt([corte, barba]))).toBe("Corte + Barba");
  });

  it("só o corte conta 1 serviço", () => {
    expect(countPlanServices(appt([corte]))).toBe(1);
  });

  it("serviço fora do plano (extra) não entra na contagem do pool", () => {
    expect(countPlanServices(appt([corte, barba, sobrancelha]))).toBe(2);
    expect(planServicesLabel(appt([corte, barba, sobrancelha]))).toBe("Corte + Barba");
  });

  it("nunca conta menos que 1 (atendimento de assinante já abate um uso)", () => {
    expect(countPlanServices(appt([sobrancelha]))).toBe(1);
    expect(countPlanServices(appt([corte, barba], { subscription: null }))).toBe(1);
  });

  it("agendamento legado sem itens usa o serviço principal", () => {
    expect(countPlanServices(appt([], { service: corte, services: [] }))).toBe(1);
  });

  it("divide o pool por serviço: combo recebe o dobro", () => {
    // Pool de R$ 1.000: A fez 10× Corte + Barba, B fez 10× só Corte → 30 serviços
    const a = Array.from({ length: 10 }, () => appt([corte, barba]));
    const b = Array.from({ length: 10 }, () => appt([corte]));
    const ticket = 1000 / totalPlanServices([...a, ...b]);
    const recebeA = a.reduce((s, x) => s + subscriptionCommission(x, ticket), 0);
    const recebeB = b.reduce((s, x) => s + subscriptionCommission(x, ticket), 0);
    expect(recebeA).toBeCloseTo(666.67, 2);
    expect(recebeB).toBeCloseTo(333.33, 2);
  });

  it("plano com comissão % desconta o material de todos os serviços do plano", () => {
    const x = appt([corte, barba, sobrancelha], {
      price: 100,
      extraPrice: 20,
      subscription: { plan: { ...planoCorteBarba, commissionPercentage: 50 } },
    });
    // (100 - 20 extra - 2 corte - 3 barba) × 50% = 37,50
    expect(subscriptionCommission(x, 999)).toBeCloseTo(37.5, 2);
  });
});
