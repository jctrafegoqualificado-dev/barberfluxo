import { prisma } from "@/lib/prisma";
import {
  type Method, METHOD_LABEL, appointmentReceipts, cardFee, expectedDrawer, isOpeningEntry, normalizeMethod, round2,
} from "@/lib/finance";

/** Meia-noite de hoje em São Paulo, como instante UTC. */
export function startOfTodaySP(now = new Date()) {
  const day = new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(now);
  return new Date(`${day}T00:00:00-03:00`);
}

export interface CashMove {
  id: string;
  at: string;
  dir: "in" | "out" | "none";
  desc: string;
  sub: string;
  method: string;
  amount: number;
  /** Lançamento manual do caixa (dá para apagar). */
  entryId?: string;
}

export interface CashSummary {
  session: {
    id: string; status: string; openedAt: string; closedAt: string | null; openingBalance: number;
    openedByName: string | null; notes: string | null;
  } | null;
  windowStart: string;
  totalIn: number;
  movesCount: number;
  tips: number;
  byMethod: { method: Method; label: string; amount: number; fee: number }[];
  drawer: { opening: number; cashIn: number; cashOut: number; expected: number };
  moves: CashMove[];
}

type SessionRow = {
  id: string; status: string; openedAt: Date; closedAt: Date | null; openingBalance: number;
  openedByName: string | null; notes: string | null;
  entries: { id: string; type: string; category: string; description: string; amount: number; paymentMethod: string | null; createdAt: Date }[];
};

const firstName = (n?: string | null) => (n ?? "").trim().split(/\s+/)[0] ?? "";

/**
 * Tudo o que passou pelo caixa no período dele (da abertura até o fechamento/agora;
 * sem caixa aberto, desde a meia-noite): atendimentos concluídos, gorjetas,
 * mensalidades pagas e os lançamentos manuais (retirar/colocar dinheiro, entradas,
 * vendas de produto).
 *
 * O atendimento entra pela hora em que foi concluído (completedAt; nos antigos, updatedAt).
 */
export async function buildCashSummary(barbershopId: string, session: SessionRow | null): Promise<CashSummary> {
  const start = session?.openedAt ?? startOfTodaySP();
  const end = session?.closedAt ?? new Date();

  const [shop, appts, payments] = await Promise.all([
    prisma.barbershop.findUnique({ where: { id: barbershopId }, select: { debitFee: true, creditFee: true } }),
    prisma.appointment.findMany({
      where: {
        barbershopId,
        OR: [
          { status: "DONE", completedAt: { gte: start, lte: end } },
          // concluídos antes de existir completedAt, e as faltas
          // (só os do próprio dia ou da véspera: editar um atendimento antigo não o traz pro caixa)
          {
            status: { in: ["DONE", "NO_SHOW"] }, completedAt: null, updatedAt: { gte: start, lte: end },
            date: { gte: new Date(start.getTime() - 36 * 3_600_000) },
          },
        ],
      },
      select: {
        id: true, status: true, updatedAt: true, completedAt: true, price: true, paymentMethod: true, subscriptionId: true,
        extraPrice: true, extraPaymentMethod: true, tipAmount: true, tipPaymentMethod: true,
        client: { select: { name: true } },
        barber: { select: { nickname: true, user: { select: { name: true } } } },
        service: { select: { name: true } },
        services: { select: { service: { select: { name: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: {
        status: "PAID", paidAt: { gte: start, lte: end },
        OR: [{ barbershopId }, { subscription: { barbershopId } }],
      },
      select: {
        id: true, amount: true, method: true, paidAt: true, gatewayType: true,
        subscription: { select: { client: { select: { name: true } }, plan: { select: { name: true } } } },
      },
    }),
  ]);
  const fees = { debitFee: shop?.debitFee ?? 0, creditFee: shop?.creditFee ?? 0 };

  const byMethod = new Map<Method, { amount: number; fee: number }>();
  const add = (m: Method, amount: number, fee = 0) => {
    const cur = byMethod.get(m) ?? { amount: 0, fee: 0 };
    byMethod.set(m, { amount: cur.amount + amount, fee: cur.fee + fee });
  };

  const moves: CashMove[] = [];
  let cashIn = 0;
  let cashOut = 0;
  let tips = 0;

  for (const a of appts) {
    const at = (a.completedAt ?? a.updatedAt).toISOString();
    const services = a.services.length > 0 ? a.services.map((s) => s.service.name).join(" + ") : a.service?.name ?? "Atendimento";
    const who = [a.client.name, a.barber.nickname || firstName(a.barber.user.name)].filter(Boolean).join(" · ");
    if (a.status === "NO_SHOW") {
      moves.push({ id: `a_${a.id}`, at, dir: "none", desc: `${services} · faltou`, sub: who, method: "—", amount: 0 });
      continue;
    }
    const receipts = appointmentReceipts(a);
    let total = 0;
    for (const r of receipts) {
      add(r.method, r.amount, cardFee(r.amount, r.method, fees));
      if (r.method === "CASH") cashIn += r.amount;
      if (r.kind === "TIP") tips += r.amount;
      total += r.amount;
    }
    const methods = [...new Set(receipts.map((r) => METHOD_LABEL[r.method]))];
    const tip = receipts.find((r) => r.kind === "TIP");
    moves.push({
      id: `a_${a.id}`, at,
      dir: total > 0 ? "in" : "none",
      desc: a.subscriptionId ? `${services} · plano` : services,
      sub: who + (tip ? ` · gorjeta ${tip.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""),
      method: total > 0 ? methods.join(" + ") : "plano",
      amount: round2(total),
    });
  }

  for (const p of payments) {
    const m = normalizeMethod(p.method);
    add(m, p.amount);
    if (m === "CASH") cashIn += p.amount;
    moves.push({
      id: `p_${p.id}`, at: (p.paidAt ?? new Date()).toISOString(), dir: "in",
      desc: `Assinatura ${p.subscription?.plan?.name ?? ""}`.trim(),
      sub: p.subscription?.client?.name ?? "Assinante",
      method: p.gatewayType ? "Cobrança automática" : METHOD_LABEL[m],
      amount: p.amount,
    });
  }

  for (const e of session?.entries ?? []) {
    if (isOpeningEntry(e)) continue; // o troco já está em openingBalance
    const m = normalizeMethod(e.paymentMethod);
    const isIn = e.type === "INCOME";
    if (isIn && e.category !== "SUPRIMENTO") add(m, e.amount, e.category === "VENDA_PRODUTO" ? cardFee(e.amount, m, fees) : 0);
    if (m === "CASH") { if (isIn) cashIn += e.amount; else cashOut += e.amount; }
    const label = e.category === "SANGRIA" ? "retirada" : e.category === "SUPRIMENTO" ? "colocou na gaveta" : e.category === "VENDA_PRODUTO" ? "produto" : isIn ? "entrada" : "saída";
    moves.push({
      id: `e_${e.id}`, entryId: e.id, at: e.createdAt.toISOString(), dir: isIn ? "in" : "out",
      desc: e.description, sub: label, method: METHOD_LABEL[m], amount: e.amount,
    });
  }

  moves.sort((x, y) => y.at.localeCompare(x.at));
  const ORDER: Method[] = ["PIX", "CASH", "CREDIT", "DEBIT", "OTHER"];
  const list = ORDER.filter((m) => byMethod.has(m)).map((m) => ({
    method: m, label: METHOD_LABEL[m], amount: round2(byMethod.get(m)!.amount), fee: round2(byMethod.get(m)!.fee),
  }));
  const opening = session?.openingBalance ?? 0;

  return {
    session: session ? {
      id: session.id, status: session.status, openedAt: session.openedAt.toISOString(),
      closedAt: session.closedAt?.toISOString() ?? null, openingBalance: opening,
      openedByName: session.openedByName, notes: session.notes,
    } : null,
    windowStart: start.toISOString(),
    totalIn: round2(list.reduce((s, x) => s + x.amount, 0)),
    movesCount: moves.filter((m) => m.dir !== "none").length,
    tips: round2(tips),
    byMethod: list,
    drawer: { opening, cashIn: round2(cashIn), cashOut: round2(cashOut), expected: expectedDrawer({ openingBalance: opening, cashIn, cashOut }) },
    moves,
  };
}

export const SESSION_INCLUDE = { entries: { orderBy: { createdAt: "desc" as const } } };
