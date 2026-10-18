/**
 * Dinheiro que entrou: formas de pagamento, taxas de maquininha e o que cada
 * atendimento concluído trouxe de fato. Caixa, Resultado do mês e Indicadores
 * usam estas funções para os números baterem entre as telas.
 */

export type Method = "PIX" | "CASH" | "CREDIT" | "DEBIT" | "OTHER";

export const METHOD_LABEL: Record<Method, string> = {
  PIX: "Pix", CASH: "Dinheiro", CREDIT: "Crédito", DEBIT: "Débito", OTHER: "Outros",
};

/** A comanda grava CREDIT_CARD/DEBIT_CARD; lançamentos antigos usam CREDIT/DEBIT. */
export function normalizeMethod(m?: string | null): Method {
  switch ((m ?? "").toUpperCase()) {
    case "PIX": return "PIX";
    case "CASH": case "DINHEIRO": return "CASH";
    case "CREDIT": case "CREDIT_CARD": return "CREDIT";
    case "DEBIT": case "DEBIT_CARD": return "DEBIT";
    default: return "OTHER";
  }
}

export interface CardFees { debitFee: number; creditFee: number }

/** Taxa da maquininha (percentual configurado na barbearia). */
export function cardFee(amount: number, method: Method, fees: CardFees): number {
  const pct = method === "DEBIT" ? fees.debitFee : method === "CREDIT" ? fees.creditFee : 0;
  return round2(amount * (pct || 0) / 100);
}

export const round2 = (v: number) => Math.round(v * 100) / 100;

export interface ApptMoney {
  price: number;
  paymentMethod: string | null;
  subscriptionId: string | null;
  extraPrice: number | null;
  extraPaymentMethod: string | null;
  tipAmount: number | null;
  tipPaymentMethod: string | null;
}

export interface Receipt { method: Method; amount: number; kind: "SERVICE" | "TIP" }

/**
 * O que um atendimento concluído trouxe de dinheiro.
 * - Avulso: o preço (já com desconto) pela forma escolhida.
 * - Assinante: o plano já foi pago na mensalidade; entra só o extra cobrado na hora.
 * - Gorjeta: dinheiro que entrou, mas é 100% do barbeiro (kind TIP).
 */
export function appointmentReceipts(a: ApptMoney): Receipt[] {
  const out: Receipt[] = [];
  const main = normalizeMethod(a.paymentMethod);
  if (!a.subscriptionId && a.price > 0) out.push({ method: main, amount: a.price, kind: "SERVICE" });
  const extra = a.extraPrice ?? 0;
  if (extra > 0) out.push({ method: normalizeMethod(a.extraPaymentMethod ?? a.paymentMethod), amount: extra, kind: "SERVICE" });
  const tip = a.tipAmount ?? 0;
  if (tip > 0) out.push({ method: normalizeMethod(a.tipPaymentMethod ?? a.extraPaymentMethod ?? a.paymentMethod), amount: tip, kind: "TIP" });
  return out;
}

/** Faturamento de serviços do atendimento (sem gorjeta). */
export function appointmentRevenue(a: ApptMoney): number {
  return appointmentReceipts(a).filter((r) => r.kind === "SERVICE").reduce((s, r) => s + r.amount, 0);
}

export interface DrawerInput {
  openingBalance: number;
  /** Tudo que entrou em dinheiro (serviços, gorjetas, produtos, mensalidades, "colocar dinheiro"). */
  cashIn: number;
  /** Tudo que saiu da gaveta ("retirar dinheiro", despesas pagas em dinheiro pelo caixa). */
  cashOut: number;
}

/** Quanto deveria ter na gaveta. */
export function expectedDrawer({ openingBalance, cashIn, cashOut }: DrawerInput): number {
  return round2(openingBalance + cashIn - cashOut);
}

/** Valor digitado: "1.234,56", "1234,56" ou "1234.56" → 1234.56 */
export function parseMoney(v: string): number {
  const s = v.trim().replace(/\s|R\$/g, "");
  const n = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return round2(Number(n) || 0);
}

/** Lançamento automático do troco de abertura (versões antigas gravavam como entrada). */
export function isOpeningEntry(e: { category: string; description: string }) {
  return e.category === "SUPRIMENTO" && e.description.startsWith("Saldo inicial");
}
