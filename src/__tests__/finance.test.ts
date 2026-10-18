import { describe, it, expect } from "vitest";
import { parseMoney, appointmentReceipts, appointmentRevenue, cardFee, expectedDrawer, isOpeningEntry, normalizeMethod } from "@/lib/finance";

const base = { price: 0, paymentMethod: null, subscriptionId: null, extraPrice: 0, extraPaymentMethod: null, tipAmount: 0, tipPaymentMethod: null };

describe("normalizeMethod", () => {
  it("cartão da comanda e dos lançamentos antigos viram o mesmo", () => {
    expect(normalizeMethod("CREDIT_CARD")).toBe("CREDIT");
    expect(normalizeMethod("CREDIT")).toBe("CREDIT");
    expect(normalizeMethod("DEBIT_CARD")).toBe("DEBIT");
    expect(normalizeMethod("PIX")).toBe("PIX");
    expect(normalizeMethod("CASH")).toBe("CASH");
    expect(normalizeMethod("BOLETO")).toBe("OTHER");
    expect(normalizeMethod(null)).toBe("OTHER");
  });
});

describe("cardFee", () => {
  const fees = { debitFee: 1.5, creditFee: 3.2 };
  it("aplica a taxa de crédito também ao CREDIT_CARD da comanda", () => {
    expect(cardFee(100, normalizeMethod("CREDIT_CARD"), fees)).toBe(3.2);
    expect(cardFee(100, "DEBIT", fees)).toBe(1.5);
  });
  it("Pix e dinheiro não têm taxa", () => {
    expect(cardFee(100, "PIX", fees)).toBe(0);
    expect(cardFee(100, "CASH", fees)).toBe(0);
  });
});

describe("appointmentReceipts", () => {
  it("avulso: o preço pela forma escolhida", () => {
    expect(appointmentReceipts({ ...base, price: 45, paymentMethod: "PIX" })).toEqual([{ method: "PIX", amount: 45, kind: "SERVICE" }]);
  });
  it("assinante: o plano não entra de novo, só o extra", () => {
    const a = { ...base, price: 45, paymentMethod: "SUBSCRIPTION", subscriptionId: "s1", extraPrice: 15, extraPaymentMethod: "CASH" };
    expect(appointmentReceipts(a)).toEqual([{ method: "CASH", amount: 15, kind: "SERVICE" }]);
    expect(appointmentRevenue(a)).toBe(15);
  });
  it("assinante sem extra não traz dinheiro", () => {
    expect(appointmentReceipts({ ...base, price: 0, paymentMethod: "SUBSCRIPTION", subscriptionId: "s1" })).toEqual([]);
  });
  it("gorjeta entra separada e não conta como faturamento", () => {
    const a = { ...base, price: 50, paymentMethod: "CREDIT_CARD", tipAmount: 10, tipPaymentMethod: "CASH" };
    expect(appointmentReceipts(a)).toEqual([
      { method: "CREDIT", amount: 50, kind: "SERVICE" },
      { method: "CASH", amount: 10, kind: "TIP" },
    ]);
    expect(appointmentRevenue(a)).toBe(50);
  });
  it("gorjeta sem forma própria usa a do atendimento", () => {
    expect(appointmentReceipts({ ...base, price: 30, paymentMethod: "PIX", tipAmount: 5 })[1]).toEqual({ method: "PIX", amount: 5, kind: "TIP" });
  });
});

describe("gaveta", () => {
  it("troco + entradas em dinheiro − retiradas", () => {
    expect(expectedDrawer({ openingBalance: 200, cashIn: 372, cashOut: 86 })).toBe(486);
  });
  it("reconhece o lançamento antigo do troco para não somar duas vezes", () => {
    expect(isOpeningEntry({ category: "SUPRIMENTO", description: "Saldo inicial (Troco)" })).toBe(true);
    expect(isOpeningEntry({ category: "SUPRIMENTO", description: "Troco extra" })).toBe(false);
  });
});

describe("parseMoney", () => {
  it("aceita o jeito brasileiro e o com ponto", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("486")).toBe(486);
    expect(parseMoney("R$ 12,5")).toBe(12.5);
    expect(parseMoney("12.50")).toBe(12.5);
    expect(parseMoney("")).toBe(0);
  });
});
