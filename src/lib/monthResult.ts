import { prisma } from "@/lib/prisma";
import { computeCommissions } from "@/lib/commissions";
import { METHOD_LABEL, appointmentReceipts, cardFee, normalizeMethod, round2, isOpeningEntry } from "@/lib/finance";

/**
 * Resultado do mês: quanto entrou, para onde foi (comissões, despesas, taxas) e quanto
 * sobrou; contas a pagar e as movimentações. Usado pela tela Resultado do mês e pela
 * planilha exportada.
 */

export const EXPENSE_CATEGORIES: Record<string, string> = {
  ESTRUTURA: "Estrutura", UTILIDADES: "Contas da casa", PESSOAS: "Pessoas", PRODUTOS: "Produtos e fornecedores",
  MARKETING: "Marketing", EQUIPAMENTOS: "Equipamentos", TAXAS: "Taxas e impostos", OUTROS: "Outros",
};

/** Início do mês (YYYY-MM) em São Paulo, como instante UTC. */
export function monthStartSP(month: string) {
  return new Date(`${month}-01T00:00:00-03:00`);
}
export function addMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function currentMonthSP(now = new Date()) {
  return new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(now).slice(0, 7);
}

export interface MonthMove {
  id: string;
  date: string;          // ISO
  dir: "in" | "out";
  status: "RECEIVED" | "PAID" | "PENDING" | "OVERDUE";
  desc: string;
  sub: string;
  method: string;
  amount: number;
  category: string;      // SERVICOS | ASSINATURAS | PRODUTOS | OUTRAS_ENTRADAS | categoria da despesa
}

const firstName = (n?: string | null) => (n ?? "").trim().split(/\s+/)[0] ?? "";

/**
 * @param until fim do período (padrão: fim do mês, ou agora se for o mês atual).
 *              O comparativo com o mês anterior passa o mesmo "dia" do mês.
 */
export async function buildMonthResult(barbershopId: string, month: string, until?: Date) {
  const start = monthStartSP(month);
  const monthEnd = monthStartSP(addMonth(month, 1));
  const end = new Date(Math.min((until ?? monthEnd).getTime(), monthEnd.getTime(), Date.now()));

  const [shop, appts, payments, sales, expenses, cashEntries, commissions] = await Promise.all([
    prisma.barbershop.findUnique({ where: { id: barbershopId }, select: { debitFee: true, creditFee: true } }),
    prisma.appointment.findMany({
      where: { barbershopId, status: "DONE", date: { gte: start, lt: end } },
      select: {
        id: true, date: true, completedAt: true, price: true, paymentMethod: true, subscriptionId: true,
        extraPrice: true, extraPaymentMethod: true, tipAmount: true, tipPaymentMethod: true,
        client: { select: { name: true } },
        barber: { select: { nickname: true, user: { select: { name: true } } } },
        service: { select: { name: true } },
        services: { select: { service: { select: { name: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: { status: "PAID", paidAt: { gte: start, lt: end }, OR: [{ barbershopId }, { subscription: { barbershopId } }] },
      select: {
        id: true, amount: true, method: true, paidAt: true, gatewayType: true,
        subscription: { select: { client: { select: { name: true } }, plan: { select: { name: true } } } },
      },
    }),
    prisma.productSale.findMany({
      where: { barbershopId, createdAt: { gte: start, lt: end } },
      select: { id: true, total: true, quantity: true, createdAt: true, product: { select: { name: true } }, client: { select: { name: true } }, barber: { select: { nickname: true, user: { select: { name: true } } } } },
    }),
    prisma.expense.findMany({ where: { barbershopId, month } }),
    // Entradas lançadas à mão no caixa (fora agenda, produto e troco)
    prisma.cashFlowEntry.findMany({
      where: { type: "INCOME", createdAt: { gte: start, lt: end }, session: { barbershopId }, category: { notIn: ["SUPRIMENTO", "VENDA_PRODUTO"] } },
      select: { id: true, amount: true, description: true, category: true, paymentMethod: true, createdAt: true },
    }),
    computeCommissions(barbershopId, start, end, month),
  ]);
  const fees = { debitFee: shop?.debitFee ?? 0, creditFee: shop?.creditFee ?? 0 };

  const moves: MonthMove[] = [];
  let services = 0;
  let taxas = 0;
  let taxasDebito = 0;
  let taxasCredito = 0;

  for (const a of appts) {
    const rec = appointmentReceipts(a).filter((r) => r.kind === "SERVICE");
    if (rec.length === 0) continue;
    let total = 0;
    let fee = 0;
    for (const r of rec) {
      const f = cardFee(r.amount, r.method, fees);
      total += r.amount;
      fee += f;
      if (r.method === "DEBIT") taxasDebito += f;
      if (r.method === "CREDIT") taxasCredito += f;
    }
    services += total;
    taxas += fee;
    const label = a.services.length > 0 ? a.services.map((s) => s.service.name).join(" + ") : a.service?.name ?? "Atendimento";
    const methods = [...new Set(rec.map((r) => METHOD_LABEL[r.method]))].join(" + ");
    moves.push({
      id: `a_${a.id}`, date: (a.completedAt ?? a.date).toISOString(), dir: "in", status: "RECEIVED",
      desc: a.subscriptionId ? `${label} · extra do plano` : label,
      sub: [a.client.name, a.barber.nickname || firstName(a.barber.user.name)].filter(Boolean).join(" · "),
      method: fee > 0 ? `${methods} · taxa ${fee.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : methods,
      amount: round2(total), category: "SERVICOS",
    });
  }

  let subscriptions = 0;
  for (const p of payments) {
    subscriptions += p.amount;
    moves.push({
      id: `p_${p.id}`, date: (p.paidAt ?? start).toISOString(), dir: "in", status: "RECEIVED",
      desc: `Assinatura ${p.subscription?.plan?.name ?? ""}`.trim(), sub: p.subscription?.client?.name ?? "Assinante",
      method: p.gatewayType ? "Cobrança automática" : METHOD_LABEL[normalizeMethod(p.method)],
      amount: p.amount, category: "ASSINATURAS",
    });
  }

  let products = 0;
  for (const s of sales) {
    products += s.total;
    moves.push({
      id: `s_${s.id}`, date: s.createdAt.toISOString(), dir: "in", status: "RECEIVED",
      desc: s.quantity > 1 ? `${s.quantity}× ${s.product.name}` : s.product.name,
      sub: [s.client?.name, s.barber ? s.barber.nickname || firstName(s.barber.user.name) : null].filter(Boolean).join(" · ") || "venda de produto",
      method: "—", amount: s.total, category: "PRODUTOS",
    });
  }

  let other = 0;
  for (const e of cashEntries) {
    if (isOpeningEntry(e)) continue;
    other += e.amount;
    moves.push({
      id: `e_${e.id}`, date: e.createdAt.toISOString(), dir: "in", status: "RECEIVED",
      desc: e.description, sub: "lançado no caixa", method: METHOD_LABEL[normalizeMethod(e.paymentMethod)],
      amount: e.amount, category: "OUTRAS_ENTRADAS",
    });
  }

  // Despesas: as pagas entram no resultado; as em aberto viram "contas a pagar"
  const todaySP = new Date(new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date()) + "T00:00:00-03:00");
  let despesas = 0;
  const byCategory = new Map<string, { value: number; names: string[] }>();
  for (const x of expenses) {
    const paid = x.status === "PAID";
    const overdue = !paid && !!x.dueDate && x.dueDate < todaySP;
    if (paid) {
      despesas += x.amount;
      const c = byCategory.get(x.category) ?? { value: 0, names: [] };
      c.value += x.amount;
      if (c.names.length < 2 && !c.names.includes(x.name.toLowerCase())) c.names.push(x.name.toLowerCase());
      byCategory.set(x.category, c);
    }
    moves.push({
      id: `x_${x.id}`, date: (paid ? x.paidAt ?? x.dueDate ?? x.createdAt : x.dueDate ?? x.createdAt).toISOString(),
      dir: "out", status: paid ? "PAID" : overdue ? "OVERDUE" : "PENDING",
      desc: x.name, sub: [EXPENSE_CATEGORIES[x.category] ?? x.category, x.isRecurring ? "recorrente" : null].filter(Boolean).join(" · "),
      method: x.paymentMethod ? (x.paymentMethod === "BOLETO" ? "Boleto" : METHOD_LABEL[normalizeMethod(x.paymentMethod)]) : "—",
      amount: x.amount, category: x.category,
    });
  }

  const bills = expenses
    .filter((x) => x.status !== "PAID")
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))
    .map((x) => ({
      id: x.id, name: x.name, amount: x.amount, dueDate: x.dueDate?.toISOString() ?? null,
      overdue: !!x.dueDate && x.dueDate < todaySP, recurring: x.isRecurring, paymentMethod: x.paymentMethod, category: x.category,
    }));

  const comissoes = commissions.barbers.reduce((s, b) => s + b.totalComissao, 0);
  const comissoesAPagar = commissions.barbers.reduce((s, b) => s + b.saldoAvulso + b.saldoAssinatura, 0);
  const entrou = services + subscriptions + products + other;
  const sobrou = entrou - comissoes - despesas - taxas;

  moves.sort((a, b) => b.date.localeCompare(a.date));

  return {
    month,
    periodEnd: end.toISOString(),
    entrou: { total: round2(entrou), services: round2(services), subscriptions: round2(subscriptions), products: round2(products), other: round2(other) },
    comissoes: round2(comissoes),
    comissoesAPagar: round2(comissoesAPagar),
    commissionBarbers: commissions.barbers
      .map((b) => ({ id: b.id, name: b.name, value: round2(b.liquidoAPagar + b.liquidoAssinatura) }))
      .filter((b) => b.value > 0)
      .sort((a, b) => b.value - a.value),
    despesas: round2(despesas),
    taxas: { total: round2(taxas), debito: round2(taxasDebito), credito: round2(taxasCredito), debitFee: fees.debitFee, creditFee: fees.creditFee },
    sobrou: round2(sobrou),
    bills,
    billsTotal: round2(bills.reduce((s, b) => s + b.amount, 0)),
    categories: [...byCategory.entries()]
      .map(([key, c]) => ({ key, name: EXPENSE_CATEGORIES[key] ?? key, example: c.names.join(", "), value: round2(c.value) }))
      .sort((a, b) => b.value - a.value),
    moves,
  };
}

export type MonthResult = Awaited<ReturnType<typeof buildMonthResult>>;
