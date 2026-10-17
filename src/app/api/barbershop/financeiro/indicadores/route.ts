import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { computeCommissions } from "@/lib/commissions";
import { appointmentReceipts, cardFee, round2 } from "@/lib/finance";
import { shopClientWhere } from "@/lib/shopClients";
import { addMonth, currentMonthSP, monthStartSP } from "@/lib/monthResult";

/**
 * Indicadores (docs/design/Indicadores-desktop.dc.html): assinaturas e pote,
 * atendimentos e serviços, clientes. Usa as mesmas contas do Caixa, Resultado do mês
 * e Comissões (src/lib/finance.ts e src/lib/commissions.ts).
 *
 * ?period=thisMonth|last7|last30|lastMonth (padrão: thisMonth)
 */

const DAY = 86_400_000;
const spDay = (d: Date) => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(d);
const dayStart = (ymd: string) => new Date(`${ymd}T00:00:00-03:00`);

function resolvePeriod(period: string) {
  const now = new Date();
  const today = spDay(now);
  if (period === "last7" || period === "last30") {
    const days = period === "last7" ? 7 : 30;
    const start = new Date(dayStart(today).getTime() - (days - 1) * DAY);
    return { key: period, start, end: now, prevStart: new Date(start.getTime() - days * DAY), prevEnd: start, monthKey: spDay(start).slice(0, 7) };
  }
  if (period === "lastMonth") {
    const m = addMonth(currentMonthSP(now), -1);
    const start = monthStartSP(m);
    const end = new Date(monthStartSP(addMonth(m, 1)).getTime() - 1);
    const pm = addMonth(m, -1);
    return { key: period, start, end, prevStart: monthStartSP(pm), prevEnd: new Date(start.getTime() - 1), monthKey: m };
  }
  const m = currentMonthSP(now);
  const start = monthStartSP(m);
  const pm = addMonth(m, -1);
  // mês anterior até o mesmo ponto, para comparar justo
  return { key: "thisMonth", start, end: now, prevStart: monthStartSP(pm), prevEnd: new Date(monthStartSP(pm).getTime() + (now.getTime() - start.getTime())), monthKey: m };
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const p = resolvePeriod(req.nextUrl.searchParams.get("period") ?? "thisMonth");

    const [shop, subs, newSubs, prevNewSubs, billing, appts, commissions, registered, lastVisits, upcoming] = await Promise.all([
      prisma.barbershop.findUnique({
        where: { id: barbershopId },
        select: { debitFee: true, creditFee: true, retentionDays: true, poeOwnerPct: true, poeDeductFees: true, poeSubscriptionFee: true },
      }),
      prisma.subscription.findMany({
        where: { barbershopId, status: { in: ["ACTIVE", "OVERDUE", "PAUSED"] } },
        select: { status: true, plan: { select: { id: true, name: true, price: true } } },
      }),
      prisma.subscription.count({ where: { barbershopId, createdAt: { gte: p.start, lte: p.end } } }),
      prisma.subscription.count({ where: { barbershopId, createdAt: { gte: p.prevStart, lte: p.prevEnd } } }),
      prisma.payment.findMany({
        where: { subscriptionId: { not: null }, createdAt: { gte: p.start, lte: p.end }, OR: [{ barbershopId }, { subscription: { barbershopId } }] },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true, amount: true, method: true, status: true, paidAt: true, createdAt: true, gatewayType: true,
          subscription: { select: { client: { select: { name: true } }, plan: { select: { name: true } } } },
        },
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", date: { gte: p.start, lte: p.end } },
        select: {
          date: true, clientId: true, price: true, paymentMethod: true, subscriptionId: true,
          extraPrice: true, extraPaymentMethod: true, tipAmount: true, tipPaymentMethod: true,
          client: { select: { name: true, phone: true } },
          service: { select: { name: true } },
          services: { select: { price: true, service: { select: { name: true } } } },
        },
      }),
      computeCommissions(barbershopId, p.start, p.end, p.monthKey),
      prisma.user.count({ where: { role: "CLIENT", ...shopClientWhere(barbershopId) } }),
      prisma.appointment.groupBy({ by: ["clientId"], where: { barbershopId, status: "DONE" }, _max: { date: true }, _min: { date: true } }),
      prisma.appointment.findMany({
        where: { barbershopId, status: { in: ["CONFIRMED", "PENDING"] }, date: { gte: dayStart(spDay(new Date())) } },
        select: { clientId: true }, distinct: ["clientId"],
      }),
    ]);
    const fees = { debitFee: shop?.debitFee ?? 0, creditFee: shop?.creditFee ?? 0 };

    // ── Assinaturas ──
    const active = subs.filter((s) => s.status === "ACTIVE");
    const overdue = subs.filter((s) => s.status === "OVERDUE").length;
    const paused = subs.filter((s) => s.status === "PAUSED").length;
    const mrr = active.reduce((s, x) => s + x.plan.price, 0);
    const plans = new Map<string, { name: string; price: number; subs: number; total: number }>();
    for (const s of active) {
      const cur = plans.get(s.plan.id) ?? { name: s.plan.name, price: s.plan.price, subs: 0, total: 0 };
      cur.subs += 1;
      cur.total += s.plan.price;
      plans.set(s.plan.id, cur);
    }

    // ── Atendimentos ──
    let revenue = 0;
    let feeTotal = 0;
    let avulsos = 0;
    const days = new Set<string>();
    const ranking = new Map<string, { name: string; count: number; revenue: number }>();
    const spent = new Map<string, { name: string; phone: string | null; visits: number; spent: number }>();
    for (const a of appts) {
      const rec = appointmentReceipts(a).filter((r) => r.kind === "SERVICE");
      const value = rec.reduce((s, r) => s + r.amount, 0);
      revenue += value;
      feeTotal += rec.reduce((s, r) => s + cardFee(r.amount, r.method, fees), 0);
      if (!a.subscriptionId) avulsos += 1;
      days.add(a.date.toISOString().slice(0, 10));
      // Ranking por serviço (Corte + Barba conta nos dois); assinante não traz faturamento do plano
      const list = a.services.length > 0 ? a.services.map((s) => ({ name: s.service.name, price: s.price })) : a.service ? [{ name: a.service.name, price: a.price }] : [];
      const scale = list.reduce((s, x) => s + x.price, 0);
      for (const s of list) {
        const cur = ranking.get(s.name) ?? { name: s.name, count: 0, revenue: 0 };
        cur.count += 1;
        cur.revenue += scale > 0 ? value * (s.price / scale) : 0;
        ranking.set(s.name, cur);
      }
      const c = spent.get(a.clientId) ?? { name: a.client.name, phone: a.client.phone, visits: 0, spent: 0 };
      c.visits += 1;
      c.spent += value;
      spent.set(a.clientId, c);
    }

    // ── Clientes ──
    const served = new Set(appts.map((a) => a.clientId));
    let newClients = 0;
    for (const g of lastVisits) {
      if (served.has(g.clientId) && g._min.date && g._min.date >= p.start) newClients += 1;
    }
    const upcomingSet = new Set(upcoming.map((u) => u.clientId));
    const limit = shop?.retentionDays ?? 45;
    const now = Date.now();
    const lapsedIds = lastVisits
      .filter((g) => g._max.date && !upcomingSet.has(g.clientId) && (now - g._max.date.getTime()) / DAY > limit)
      .sort((a, b) => b._max.date!.getTime() - a._max.date!.getTime());
    const lapsedUsers = await prisma.user.findMany({
      where: { id: { in: lapsedIds.slice(0, 8).map((g) => g.clientId) }, role: "CLIENT", isBlocked: false },
      select: { id: true, name: true, phone: true },
    });
    const lapsedList = lapsedIds.slice(0, 8).flatMap((g) => {
      const u = lapsedUsers.find((x) => x.id === g.clientId);
      return u ? [{ id: u.id, name: u.name, phone: u.phone, lastVisit: g._max.date!.toISOString(), days: Math.floor((now - g._max.date!.getTime()) / DAY) }] : [];
    });

    const pool = commissions.pool;
    return NextResponse.json({
      period: { key: p.key, start: p.start.toISOString(), end: p.end.toISOString() },
      subscriptions: {
        mrr: round2(mrr), active: active.length, overdue, paused,
        payingRate: active.length + overdue > 0 ? Math.round((active.length / (active.length + overdue)) * 100) : 100,
        newSubs, prevNewSubs,
        plans: [...plans.values()].sort((a, b) => b.subs - a.subs),
        billing: billing.map((b) => ({
          id: b.id, amount: b.amount, status: b.status, date: (b.paidAt ?? b.createdAt).toISOString(),
          method: b.gatewayType ? "cobrança automática" : b.method, clientName: b.subscription?.client.name ?? "Assinante",
          planName: b.subscription?.plan.name ?? "Plano",
        })),
        billingProblems: billing.filter((b) => b.status === "FAILED" || (b.status === "PENDING" && b.createdAt.getTime() < now - 3 * DAY)).length,
      },
      pool: {
        ...pool,
        share: commissions.barbers
          .filter((b) => b.assinatura.servicos > 0)
          .map((b) => ({ id: b.id, name: b.name, services: b.assinatura.servicos, poolServices: b.assinatura.servicosPote, poolValue: round2(b.assinatura.comissaoPote), ownServices: b.assinatura.servicosProprio, ownValue: round2(b.assinatura.comissaoProprio), value: round2(b.assinatura.comissao) }))
          .sort((a, b) => b.services - a.services),
      },
      services: {
        count: appts.length, avulsos, daysOpen: days.size,
        revenue: round2(revenue), fees: round2(feeTotal), net: round2(revenue - feeTotal), ...fees,
        avgTicket: avulsos > 0 ? round2(revenue / avulsos) : 0,
        ranking: [...ranking.values()].map((r) => ({ ...r, revenue: round2(r.revenue) })).sort((a, b) => b.count - a.count).slice(0, 8),
        barbers: commissions.barbers
          .map((b) => ({ id: b.id, name: b.name, count: b.avulso.atendimentos + b.assinatura.atendimentos, gross: round2(b.avulso.faturado), commission: round2(b.totalComissao) }))
          .sort((a, b) => b.gross - a.gross),
      },
      clients: {
        registered, served: served.size, newClients, returned: served.size - newClients,
        top: [...spent.values()].sort((a, b) => b.spent - a.spent).slice(0, 8).map((c) => ({ ...c, spent: round2(c.spent) })),
        lapsedDays: limit, lapsedCount: lapsedIds.length, lapsed: lapsedList,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
