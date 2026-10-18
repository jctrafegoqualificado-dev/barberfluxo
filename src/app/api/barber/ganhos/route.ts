import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { appointmentCommission, avulsoCommission, computeCommissions, extraCommission, productSaleCommission } from "@/lib/commissions";
import { SUBSCRIPTION_APPT_INCLUDE, baseSubscriptionPrice, planServicesLabel, subscriptionCommission } from "@/lib/subscriptionServices";
import { addMonth, currentMonthSP, monthStartSP } from "@/lib/monthResult";
import { addDaysKey, todayKeySP } from "@/lib/subscriptionCycle";

/**
 * Seus ganhos (tela do barbeiro): resumo do mês com os MESMOS números das Comissões do dono
 * (computeCommissions), comissão por dia, previsão, comparação com o mês anterior, serviços
 * mais feitos e o extrato (avulsos, assinaturas e produtos).
 * GET ?month=YYYY-MM (padrão: mês atual em São Paulo)
 */

const dayStart = (k: string) => new Date(`${k}T00:00:00Z`);
const keyOf = (d: Date) => d.toISOString().slice(0, 10);
const spKey = (d: Date) => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(d);

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["BARBER", "OWNER"]);
    const barber = await prisma.barber.findUnique({ where: { userId: payload.id }, include: { user: { select: { name: true } } } });
    if (!barber) return NextResponse.json({ error: "Perfil de barbeiro não encontrado" }, { status: 404 });
    const barbershopId = barber.barbershopId;

    const current = currentMonthSP();
    const param = req.nextUrl.searchParams.get("month") ?? "";
    const month = /^\d{4}-\d{2}$/.test(param) && param <= current ? param : current;
    const isCurrent = month === current;
    const today = todayKeySP();
    const start = monthStartSP(month);
    const end = new Date(monthStartSP(addMonth(month, 1)).getTime() - 1);
    const firstDay = `${month}-01`;
    const nextFirst = `${addMonth(month, 1)}-01`;

    const [{ barbers: rows, ticketMedioSub }, appts, sales] = await Promise.all([
      computeCommissions(barbershopId, start, end, month),
      prisma.appointment.findMany({
        where: { barberId: barber.id, date: { gte: dayStart(firstDay), lt: dayStart(nextFirst) }, status: { in: ["DONE", "NO_SHOW", "CONFIRMED", "PENDING"] } },
        select: {
          id: true, date: true, startTime: true, status: true, price: true, extraPrice: true, tipAmount: true, subscriptionId: true,
          client: { select: { name: true } },
          ...SUBSCRIPTION_APPT_INCLUDE,
          service: { select: { id: true, name: true, materialCost: true, commission: true } },
          services: { select: { price: true, service: { select: { id: true, name: true, materialCost: true } } } },
          subscription: { select: { plan: { select: { name: true, commissionPercentage: true, planServices: { select: { serviceId: true } } } } } },
        },
        orderBy: [{ date: "desc" }, { startTime: "desc" }],
      }),
      prisma.productSale.findMany({
        where: { barberId: barber.id, createdAt: { gte: start, lte: end } },
        select: { id: true, createdAt: true, quantity: true, total: true, product: { select: { name: true, commissionType: true, commissionValue: true } }, client: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const row = rows.find((r) => r.id === barber.id) ?? null;

    const done = appts.filter((a) => a.status === "DONE");
    const noShow = appts.filter((a) => a.status === "NO_SHOW").length;
    const open = appts.filter((a) => (a.status === "CONFIRMED" || a.status === "PENDING") && keyOf(a.date) >= today);

    // Totais (iguais às Comissões do dono)
    const servicos = (row?.avulso.comissao ?? 0) + (row?.assinatura.comissao ?? 0);
    const produtos = row?.produtos.comissao ?? 0;
    const gorjetas = row?.gorjetas.total ?? 0;
    const vales = row?.totalVales ?? 0;
    const total = servicos + produtos + gorjetas;

    // Comissão por dia (serviços + gorjetas + produtos)
    const byDay = new Map<string, number>();
    const add = (k: string, v: number) => byDay.set(k, (byDay.get(k) ?? 0) + v);
    for (const a of done) add(keyOf(a.date), appointmentCommission(a, barber, ticketMedioSub) + (a.tipAmount ?? 0));
    for (const s of sales) add(spKey(s.createdAt), productSaleCommission(s, barber));
    const lastKey = isCurrent ? today : addDaysKey(nextFirst, -1);
    const days: { date: string; value: number }[] = [];
    for (let k = firstDay; k <= lastKey; k = addDaysKey(k, 1)) days.push({ date: k, value: byDay.get(k) ?? 0 });
    const best = days.reduce<{ date: string; value: number } | null>((b, d) => (d.value > (b?.value ?? 0) ? d : b), null);

    // Mês corrente: previsão (o que já tem + o que está agendado) e comparação com o mês anterior no mesmo período
    let forecast: number | null = null;
    let previousSamePeriod: number | null = null;
    if (isCurrent) {
      forecast = total + open.reduce((s, a) => s + appointmentCommission(a, barber, ticketMedioSub), 0);
      const prev = addMonth(month, -1);
      const prevDay = Math.min(Number(today.slice(8)), new Date(Date.UTC(Number(prev.slice(0, 4)), Number(prev.slice(5)), 0)).getUTCDate());
      const prevEnd = new Date(`${prev}-${String(prevDay).padStart(2, "0")}T23:59:59.999-03:00`);
      const { barbers: prevRows } = await computeCommissions(barbershopId, monthStartSP(prev), prevEnd, prev);
      const p = prevRows.find((r) => r.id === barber.id);
      previousSamePeriod = p ? p.avulso.comissao + p.assinatura.comissao + p.produtos.comissao + p.gorjetas.total : 0;
    }

    // Serviços que mais fez
    const svc = new Map<string, { name: string; count: number; revenue: number }>();
    for (const a of done) {
      const list = a.services.length ? a.services.map((s) => ({ id: s.service.id, name: s.service.name, price: s.price })) : a.service ? [{ id: a.service.id, name: a.service.name, price: a.price }] : [];
      for (const s of list) {
        const cur = svc.get(s.id) ?? { name: s.name, count: 0, revenue: 0 };
        svc.set(s.id, { name: s.name, count: cur.count + 1, revenue: cur.revenue + (a.subscriptionId ? 0 : s.price) });
      }
    }

    // Extrato
    const label = (a: (typeof done)[number]) => (a.services.length ? a.services.map((s) => s.service.name).join(" + ") : a.service?.name ?? "Atendimento");
    const avulsoItems = done.filter((a) => !a.subscriptionId).map((a) => ({
      id: a.id, date: keyOf(a.date), time: a.startTime, client: a.client.name, label: label(a),
      valor: a.price, comissao: avulsoCommission(a, barber), gorjeta: a.tipAmount ?? 0,
    }));
    const extraItems = done.filter((a) => (a.extraPrice ?? 0) > 0).map((a) => ({
      id: `${a.id}-extra`, date: keyOf(a.date), time: a.startTime, client: a.client.name, label: `${label(a)} · extra`,
      valor: a.extraPrice ?? 0, comissao: extraCommission(a, barber), gorjeta: a.subscriptionId ? a.tipAmount ?? 0 : 0,
    }));
    const subItems = done.filter((a) => a.subscriptionId).map((a) => ({
      id: a.id, date: keyOf(a.date), time: a.startTime, client: a.client.name, label: planServicesLabel(a),
      plano: a.subscription?.plan?.name ?? "Plano", valor: baseSubscriptionPrice(a), comissao: subscriptionCommission(a, ticketMedioSub),
      proprio: a.subscription?.plan?.commissionPercentage != null,
    }));
    const productItems = sales.map((s) => ({
      id: s.id, date: spKey(s.createdAt), client: s.client?.name ?? null, label: s.product?.name ?? "Produto", qty: s.quantity,
      valor: s.total, comissao: productSaleCommission(s, barber),
    }));

    const res = NextResponse.json({
      name: barber.user.name,
      month, isCurrent, today,
      rates: { commissionType: barber.commissionType, commission: barber.commission, productCommissionType: barber.productCommissionType, productCommission: barber.productCommission },
      summary: {
        total, servicos, produtos, gorjetas, vales,
        // Dono paga em duas partes: avulsos+produtos+gorjetas (menos vales) e assinaturas
        assinatura: row?.assinatura.comissao ?? 0,
        aReceber: (row?.paid ? 0 : Math.max(0, total - (row?.assinatura.comissao ?? 0) - vales)) + (row?.subPaid ? 0 : row?.assinatura.comissao ?? 0),
        avulsoFaturado: row?.avulso.faturado ?? 0,
        produtosVendidos: row?.produtos.vendas ?? 0,
        assinaturaServicos: row?.assinatura.servicos ?? 0,
        ticketPote: ticketMedioSub,
        paid: row?.paid ?? null, subPaid: row?.subPaid ?? null,
        valesList: row?.vales ?? [],
      },
      forecast, previousSamePeriod,
      kpis: {
        atendimentos: done.length,
        ticketMedio: done.length ? done.reduce((s, a) => s + a.price, 0) / done.length : 0,
        comparecimento: done.length + noShow > 0 ? done.length / (done.length + noShow) : null,
        noShow,
        avulsos: done.filter((a) => !a.subscriptionId).length,
        assinantes: done.filter((a) => a.subscriptionId).length,
      },
      days, best,
      services: [...svc.values()].sort((a, b) => b.count - a.count).slice(0, 6),
      items: { avulso: [...avulsoItems, ...extraItems].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), assinatura: subItems, produtos: productItems },
    });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
