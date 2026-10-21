import { prisma } from "@/lib/prisma";
import {
  SUBSCRIPTION_APPT_INCLUDE,
  baseSubscriptionPrice,
  countPlanServices,
  extraServicesPerformed,
  planServicesLabel,
  subscriptionCommission,
  totalPlanServices,
} from "@/lib/subscriptionServices";

/**
 * Comissões do período, por profissional. Regras (as mesmas desde antes do redesign):
 * - Avulso: % (ou valor fixo) do profissional sobre o preço menos o custo de material;
 *   serviço com comissão própria usa a dele. Extras de assinante entram como avulso.
 * - Assinatura: do que foi PAGO de assinaturas no período, a parte dos profissionais
 *   (padrão 50%, configurável em Indicadores; ver poolOf) vai para o pote dos
 *   profissionais; o pote é dividido pelo total de serviços de plano realizados (Corte +
 *   Barba = 2) e cada um recebe esse valor × os serviços que fez. Plano com comissão
 *   própria usa a % dele.
 * - Produtos: % ou valor fixo por produto (ou o padrão do profissional).
 * - Gorjetas: 100% do profissional, somadas no acerto avulso. Vales são descontados.
 *
 * Decisões de 21/10/2026: comissão fixa (R$) vale por SERVIÇO (combo Corte + Barba paga 2×);
 * cada serviço do combo segue a regra dele; plano com comissão própria usa o preço dos
 * serviços feitos; plano trimestral/anual entra no pote dividido pelos meses do ciclo;
 * mês com mensalidade e nenhum serviço de plano passa a parte dos barbeiros para o seguinte.
 *
 * Usada pela tela Comissões e pelo Resultado do mês, para os números baterem.
 */

function calcComissao(valor: number, type: string, rate: number): number {
  if (type === "FIXED") return rate;
  return valor * (rate / 100);
}

// ── Comissão de um item (mesma regra em todas as telas: Comissões, Ganhos e Início do barbeiro) ──

export interface BarberRates {
  commissionType: string; commission: number;
  productCommissionType: string; productCommission: number;
}
type ServiceRule = { materialCost?: number | null; commission?: number | null; price?: number | null };
type AvulsoAppt = {
  price: number;
  service?: ServiceRule | null;
  services?: { price?: number | null; service: ServiceRule }[] | null;
};

/**
 * Avulso: cada serviço feito segue a regra dele. Serviço com comissão própria usa a % dele;
 * os outros, a do profissional (% sobre preço − material, ou valor fixo POR SERVIÇO).
 * O preço gravado no atendimento (já com desconto ou editado na comanda) é repartido entre
 * os serviços na proporção do preço de cada um.
 */
export function avulsoCommission(a: AvulsoAppt, b: Pick<BarberRates, "commissionType" | "commission">): number {
  const items = a.services && a.services.length > 0
    ? a.services.map((x) => ({ price: x.price ?? x.service.price ?? 0, rule: x.service }))
    : [{ price: a.price, rule: a.service ?? {} }];
  const listed = items.reduce((sum, x) => sum + x.price, 0);
  return items.reduce((sum, x) => {
    // parte do preço cobrado que cabe a este serviço
    const charged = listed > 0 ? a.price * (x.price / listed) : a.price / items.length;
    const net = Math.max(0, charged - (x.rule.materialCost || 0));
    if (x.rule.commission != null) return sum + calcComissao(net, "PERCENTAGE", x.rule.commission);
    return sum + calcComissao(net, b.commissionType, b.commission);
  }, 0);
}

/**
 * Extra cobrado além do plano: comissiona como avulso pela taxa do profissional.
 * Comissão fixa vale por serviço extra feito (count); sem a lista, conta 1.
 */
export function extraCommission(a: { extraPrice?: number | null }, b: Pick<BarberRates, "commissionType" | "commission">, count = 1): number {
  if ((a.extraPrice ?? 0) <= 0) return 0;
  return b.commissionType === "FIXED" ? b.commission * Math.max(1, count) : calcComissao(a.extraPrice ?? 0, b.commissionType, b.commission);
}

/** Quantos serviços extras (fora do plano) o atendimento teve, para a comissão fixa. */
export function extraCount(a: Parameters<typeof extraServicesPerformed>[0] & { subscriptionId?: string | null }): number {
  return a.subscriptionId ? Math.max(1, extraServicesPerformed(a).length) : 1;
}

/** Comissão do atendimento inteiro: avulso ou assinatura (pote/% do plano) + extra. Sem gorjeta. */
export function appointmentCommission(
  a: AvulsoAppt & { subscriptionId?: string | null; extraPrice?: number | null } & Parameters<typeof subscriptionCommission>[0],
  b: Pick<BarberRates, "commissionType" | "commission">,
  ticket: number,
): number {
  return (a.subscriptionId ? subscriptionCommission(a, ticket) : avulsoCommission(a, b)) + extraCommission(a, b, extraCount(a));
}

/** Venda de produto: regra do produto ou a padrão do profissional. */
export function productSaleCommission(
  p: { total: number; quantity: number; product?: { commissionType?: string | null; commissionValue?: number | null } | null },
  b: Pick<BarberRates, "productCommissionType" | "productCommission">,
): number {
  const type = p.product?.commissionType || b.productCommissionType;
  const value = p.product?.commissionValue != null ? p.product.commissionValue : b.productCommission;
  return type === "FIXED" ? value * p.quantity : calcComissao(p.total, type, value);
}

/**
 * Pote das assinaturas: do que foi pago no período, desconta a taxa (se a barbearia
 * marcou), a parte da barbearia fica com ela e o resto é dividido pelos serviços de
 * plano realizados. Padrão: 50% / 50%, sem descontar taxa.
 */
export function poolOf(
  gross: number,
  services: number,
  shop: { poeOwnerPct: number; poeDeductFees: boolean; poeSubscriptionFee: number } | null,
  carried = 0,
) {
  const ownerPct = shop?.poeOwnerPct ?? 50;
  const feePct = shop?.poeDeductFees ? shop.poeSubscriptionFee ?? 0 : 0;
  const fees = gross * (feePct / 100);
  const net = gross - fees;
  const shopPart = net * (ownerPct / 100);
  // carried = parte dos barbeiros de meses sem nenhum serviço de plano, que passa para este
  const barbersPart = net - shopPart + carried;
  return {
    gross, fees, feePct, deductFees: !!shop?.poeDeductFees, net, ownerPct,
    shopPart, barbersPart, carried, services, ticket: services > 0 ? barbersPart / services : 0,
  };
}

/** Mensalidades pagas no período que alimentam o pote (inclui as do Mercado Pago sem barbershopId). */
export function subscriptionPaymentsWhere(barbershopId: string, start: Date, end: Date) {
  return {
    subscriptionId: { not: null }, status: "PAID", paidAt: { gte: start, lte: end },
    OR: [{ barbershopId }, { subscription: { barbershopId } }],
  };
}

/** Plano com comissão própria (%) fica fora do pote: nem o dinheiro nem os atendimentos dele entram na divisão. */
type WithPlan = { subscription?: { plan?: { commissionPercentage?: number | null } | null } | null };
export const isOwnCommissionPlan = (x: WithPlan) => x.subscription?.plan?.commissionPercentage != null;

/** Seleção das mensalidades para o pote (valor + se o plano tem comissão própria). */
export const POOL_PAYMENT_SELECT = { amount: true, subscription: { select: { plan: { select: { commissionPercentage: true } } } } } as const;

/** Arrecadado que entra no pote: mensalidades dos planos sem comissão própria. */
export function poolRevenue(payments: ({ amount: number } & WithPlan)[]) {
  return payments.filter((p) => !isOwnCommissionPlan(p)).reduce((s, p) => s + p.amount, 0);
}

/** Atendimentos que dividem o pote: os dos planos sem comissão própria. */
export function poolServices(appts: Parameters<typeof totalPlanServices>[0]) {
  return totalPlanServices(appts.filter((a) => !isOwnCommissionPlan(a)));
}

/** Configuração do pote da barbearia (parte da barbearia e taxa). */
export function poolSettings(barbershopId: string) {
  return prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { poeOwnerPct: true, poeDeductFees: true, poeSubscriptionFee: true },
  });
}

// ── Pote de um mês (YYYY-MM): divisão de planos longos e repasse de meses sem serviço ──

const CYCLE_MONTHS: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 };
const monthKeyOf = (d: Date) => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(d).slice(0, 7);
const monthStart = (m: string) => new Date(m + "-01T00:00:00-03:00");
const shiftMonth = (m: string, delta: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
};
const monthsBetween = (from: string, to: string) => {
  const [a, b] = from.split("-").map(Number);
  const [c, d] = to.split("-").map(Number);
  return (c - a) * 12 + (d - b);
};
const MAX_LOOKBACK = 12;
type PoolCfg = { poeOwnerPct: number; poeDeductFees: boolean; poeSubscriptionFee: number } | null;

/**
 * Pote das assinaturas de um mês, com as regras de 21/10/2026:
 * - mensalidade de plano trimestral/anual entra dividida pelos meses do ciclo, a partir do
 *   mês em que foi paga (anual de R$ 1.200 pago em janeiro = R$ 100 por mês até dezembro);
 * - se um mês teve mensalidade e nenhum serviço de plano, a parte dos barbeiros passa para o
 *   mês seguinte (olhando até 12 meses para trás).
 * Planos com comissão própria ficam fora (dinheiro e serviços), como antes.
 */
export async function poolForMonth(barbershopId: string, month: string, shop?: PoolCfg) {
  const cfg = shop === undefined ? await poolSettings(barbershopId) : shop;
  const firstPaid = shiftMonth(month, -(MAX_LOOKBACK + 11)); // pagamentos que ainda rendem parcelas
  const end = new Date(monthStart(shiftMonth(month, 1)).getTime() - 1);
  const [payments, appts] = await Promise.all([
    prisma.payment.findMany({
      where: subscriptionPaymentsWhere(barbershopId, monthStart(firstPaid), end),
      select: { amount: true, paidAt: true, subscription: { select: { plan: { select: { commissionPercentage: true, billingCycle: true } } } } },
    }),
    prisma.appointment.findMany({
      where: { barbershopId, status: "DONE", subscriptionId: { not: null }, date: { gte: monthStart(shiftMonth(month, -MAX_LOOKBACK)), lte: end } },
      select: { date: true, price: true, extraPrice: true, ...SUBSCRIPTION_APPT_INCLUDE },
    }),
  ]);
  const revenueOf = (m: string) => payments.reduce((sum, p) => {
    if (isOwnCommissionPlan(p) || !p.paidAt) return sum;
    const cycle = CYCLE_MONTHS[p.subscription?.plan?.billingCycle ?? "MONTHLY"] ?? 1;
    const k = monthsBetween(monthKeyOf(p.paidAt), m);
    return k >= 0 && k < cycle ? sum + p.amount / cycle : sum;
  }, 0);
  const servicesOf = (m: string) => poolServices(appts.filter((a) => monthKeyOf(a.date) === m));

  let carried = 0;
  for (let k = 1; k <= MAX_LOOKBACK; k++) {
    const m = shiftMonth(month, -k);
    if (servicesOf(m) > 0) break;
    carried += poolOf(revenueOf(m), 0, cfg).barbersPart;
  }
  return poolOf(revenueOf(month), servicesOf(month), cfg, carried);
}

export async function computeCommissions(barbershopId: string, start: Date, end: Date, monthKey: string) {
  const barbers = await prisma.barber.findMany({
    // Todos (inclusive em férias, inativos e excluídos): quem trabalhou no mês e depois
    // saiu de férias continua tendo comissão a receber. Sem movimento, só os ativos aparecem.
    where: { barbershopId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const shop = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { poeOwnerPct: true, poeDeductFees: true, poeSubscriptionFee: true },
  });
  const emptyPool = poolOf(0, 0, shop);
  const isMonth = /^\d{4}-\d{2}$/.test(monthKey);
  if (barbers.length === 0) return { barbers: [], totalSubRevenue: 0, ticketMedioSub: 0, pool: emptyPool };

    const [subPayments, allAvulsos, allSubAppointments, allProductSales, allCommissionPayments, allVales, allReviews] = await Promise.all([
      prisma.payment.findMany({
        // Mensalidades cobradas pelo Mercado Pago podem vir sem barbershopId: busca pela assinatura também
        where: { subscriptionId: { not: null }, status: "PAID", paidAt: { gte: start, lte: end }, OR: [{ barbershopId }, { subscription: { barbershopId } }] },
        select: POOL_PAYMENT_SELECT,
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", subscriptionId: null, date: { gte: start, lte: end } },
        include: { service: true, client: { select: { name: true } }, services: { select: { price: true, service: { select: { price: true, materialCost: true, commission: true } } } } },
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", subscriptionId: { not: null }, date: { gte: start, lte: end } },
        include: { ...SUBSCRIPTION_APPT_INCLUDE, client: { select: { name: true } } },
      }),
      prisma.productSale.findMany({
        where: { barbershopId, createdAt: { gte: start, lte: end } },
        include: { product: true },
      }),
      prisma.commissionPayment.findMany({
        where: { barbershopId, month: monthKey },
        orderBy: { paidAt: "asc" },
      }),
      prisma.commissionVale.findMany({
        where: { barbershopId, month: monthKey },
        orderBy: { createdAt: "asc" },
      }),
      prisma.review.findMany({
        where: { barbershopId, createdAt: { gte: start, lte: end } },
      }),
    ]);

    // ── Pool de assinaturas (calculado globalmente) ──
    // Plano com comissão própria fica fora do pote (dinheiro e atendimentos)
    // Mês: regra completa (planos longos divididos e repasse de mês sem serviço).
    // Período personalizado: o que foi pago no período, como antes.
    const pool = isMonth
      ? await poolForMonth(barbershopId, monthKey, shop)
      : poolOf(poolRevenue(subPayments), poolServices(allSubAppointments), shop);
    const totalSubRevenue = pool.gross;
    const ticketMedioSub = pool.ticket;

    // ── Agrupamento em memória por barbeiro ──
    const result = barbers.map((b) => {
      const avulsos = allAvulsos.filter((a) => a.barberId === b.id);
      const subAppointments = allSubAppointments.filter((a) => a.barberId === b.id);
      const productSales = allProductSales.filter((p) => p.barberId === b.id);
      const vales = allVales.filter((v) => v.barberId === b.id);
      const reviews = allReviews.filter((r) => r.barberId === b.id);
      // Avulsos são pagos por semana (vários pagamentos no mês); assinaturas, uma vez depois que o mês fecha
      const standardPayments = allCommissionPayments.filter((cp) => cp.barberId === b.id && cp.type === "STANDARD");
      const subscriptionPayments = allCommissionPayments.filter((cp) => cp.barberId === b.id && cp.type === "SUBSCRIPTION");
      const pagoAvulso = standardPayments.reduce((s, p) => s + p.amount, 0);
      const pagoAssinatura = subscriptionPayments.reduce((s, p) => s + p.amount, 0);
      const lastOf = (list: typeof standardPayments) => list.length ? { paidAt: list[list.length - 1].paidAt, amount: list.reduce((s, p) => s + p.amount, 0) } : null;

      const totalAvulso = avulsos.reduce((s, a) => s + a.price, 0);
      const totalDescontos = avulsos.reduce((s, a) => {
        if (!a.discountPercent || a.discountPercent === 0) return s;
        const original = a.price / (1 - a.discountPercent / 100);
        return s + (original - a.price);
      }, 0);
      // Serviços extras cobrados além do plano (ex.: sobrancelha de um assinante) são tratados
      // como AVULSO: comissão pela taxa padrão do barbeiro e somados ao acerto avulso (Líquido a Pagar).
      const extraAppts = [...avulsos, ...subAppointments].filter((a) => (a.extraPrice ?? 0) > 0);
      const totalExtra = extraAppts.reduce((s, a) => s + (a.extraPrice ?? 0), 0);
      const comissaoExtra = extraAppts.reduce((s, a) => s + extraCommission(a, b, "subscription" in a ? extraCount(a) : 1), 0);

      const comissaoAvulsoBase = avulsos.reduce((s, a) => s + avulsoCommission(a, b), 0);
      const comissaoAvulso = comissaoAvulsoBase + comissaoExtra;

      const comissaoAssinatura = subAppointments.reduce((s, a) => s + subscriptionCommission(a, ticketMedioSub), 0);
      // Separação para exibir: o que veio do pote (ticket × serviços) e o que veio de plano
      // com comissão própria (% do plano). Não muda o valor, só mostra de onde ele vem.
      const ownPlan = (a: (typeof subAppointments)[number]) => a.subscription?.plan?.commissionPercentage != null;
      const servicosPote = subAppointments.filter((a) => !ownPlan(a)).reduce((s, a) => s + countPlanServices(a), 0);
      const servicosProprio = subAppointments.filter(ownPlan).reduce((s, a) => s + countPlanServices(a), 0);
      const comissaoProprio = subAppointments.filter(ownPlan).reduce((s, a) => s + subscriptionCommission(a, ticketMedioSub), 0);

      const totalProdutos = productSales.reduce((s, p) => s + p.total, 0);
      const comissaoProdutos = productSales.reduce((s, p) => s + productSaleCommission(p, b), 0);

      const totalComissao = comissaoAvulso + comissaoAssinatura + comissaoProdutos;
      const totalVales = vales.reduce((s, v) => s + v.amount, 0);
      // Gorjeta é 100% do barbeiro (avulsos e assinantes) e vai junto no acerto avulso.
      const gorjetaAppts = [...avulsos, ...subAppointments].filter((a) => (a.tipAmount ?? 0) > 0);
      const totalGorjetas = gorjetaAppts.reduce((s, a) => s + a.tipAmount, 0);
      const liquidoAPagar = Math.max(0, comissaoAvulso + comissaoProdutos + totalGorjetas - totalVales);
      const liquidoAssinatura = comissaoAssinatura;
      // O que ainda falta pagar (centavos de arredondamento não contam)
      const saldo = (v: number) => (v > 0.009 ? Math.round(v * 100) / 100 : 0);
      const saldoAvulso = saldo(liquidoAPagar - pagoAvulso);
      const saldoAssinatura = saldo(liquidoAssinatura - pagoAssinatura);

      let promoters = 0;
      let detractors = 0;
      reviews.forEach((r) => {
        if (r.rating >= 9) promoters++;
        else if (r.rating <= 6) detractors++;
      });
      const npsScore = reviews.length > 0
        ? Math.round(((promoters - detractors) / reviews.length) * 100)
        : null;

      return {
        id: b.id,
        name: b.user.name,
        email: b.user.email,
        commissionType: b.commissionType,
        commission: b.commission,
        productCommissionType: b.productCommissionType,
        productCommission: b.productCommission,
        avulso: {
          atendimentos: avulsos.length,
          faturado: totalAvulso + totalExtra,
          comissao: comissaoAvulso,
          totalDescontos: Math.round(totalDescontos * 100) / 100,
          items: [
            ...avulsos.map((a) => ({
              date: a.date.toISOString(),
              clientName: a.client?.name ?? "—",
              serviceName: a.service?.name ?? "—",
              price: a.price,
            })),
            ...extraAppts.map((a) => ({
              date: a.date.toISOString(),
              clientName: a.client?.name ?? "—",
              serviceName: `${a.service?.name ?? "—"} (extra)`,
              price: a.extraPrice ?? 0,
            })),
          ],
        },
        assinatura: {
          servicos: subAppointments.reduce((s, a) => s + countPlanServices(a), 0),
          atendimentos: subAppointments.length,
          servicosPote, servicosProprio,
          comissaoPote: ticketMedioSub * servicosPote,
          comissaoProprio,
          ticketMedio: ticketMedioSub,
          comissao: comissaoAssinatura,
          items: subAppointments.map((a) => ({
            date: a.date.toISOString(),
            clientName: a.client?.name ?? "—",
            serviceName: planServicesLabel(a),
            price: baseSubscriptionPrice(a),
          })),
        },
        produtos: {
          vendas: productSales.length,
          faturado: totalProdutos,
          comissao: comissaoProdutos,
        },
        gorjetas: {
          quantidade: gorjetaAppts.length,
          total: totalGorjetas,
        },
        totalComissao,
        totalVales,
        liquidoAPagar,
        liquidoAssinatura,
        vales: vales.map((v) => ({ id: v.id, amount: v.amount, description: v.description, createdAt: v.createdAt })),
        /** Soma do que já foi pago de avulsos no mês e a data do último pagamento */
        paid: lastOf(standardPayments),
        subPaid: lastOf(subscriptionPayments),
        saldoAvulso,
        saldoAssinatura,
        pagamentos: allCommissionPayments
          .filter((cp) => cp.barberId === b.id)
          .map((cp) => ({ id: cp.id, type: cp.type as "STANDARD" | "SUBSCRIPTION", amount: cp.amount, paidAt: cp.paidAt, notes: cp.notes })),
        npsScore,
      };
    });


  const shown = result.filter((r) => {
    const b = barbers.find((x) => x.id === r.id)!;
    const moved = r.avulso.atendimentos + r.assinatura.atendimentos + r.produtos.vendas + r.vales.length > 0 || !!r.paid || !!r.subPaid;
    return (b.active && !b.archivedAt) || moved;
  });
  return { barbers: shown, totalSubRevenue, ticketMedioSub, pool };
}

export type CommissionRow = Awaited<ReturnType<typeof computeCommissions>>["barbers"][number];
