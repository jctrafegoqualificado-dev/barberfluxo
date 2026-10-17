import { prisma } from "@/lib/prisma";
import {
  SUBSCRIPTION_APPT_INCLUDE,
  baseSubscriptionPrice,
  countPlanServices,
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
 * Usada pela tela Comissões e pelo Resultado do mês, para os números baterem.
 */

function calcComissao(valor: number, type: string, rate: number): number {
  if (type === "FIXED") return rate;
  return valor * (rate / 100);
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
) {
  const ownerPct = shop?.poeOwnerPct ?? 50;
  const feePct = shop?.poeDeductFees ? shop.poeSubscriptionFee ?? 0 : 0;
  const fees = gross * (feePct / 100);
  const net = gross - fees;
  const shopPart = net * (ownerPct / 100);
  const barbersPart = net - shopPart;
  return {
    gross, fees, feePct, deductFees: !!shop?.poeDeductFees, net, ownerPct,
    shopPart, barbersPart, services, ticket: services > 0 ? barbersPart / services : 0,
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
  if (barbers.length === 0) return { barbers: [], totalSubRevenue: 0, ticketMedioSub: 0, pool: emptyPool };

    const [subPayments, allAvulsos, allSubAppointments, allProductSales, allCommissionPayments, allVales, allReviews] = await Promise.all([
      prisma.payment.findMany({
        // Mensalidades cobradas pelo Mercado Pago podem vir sem barbershopId: busca pela assinatura também
        where: { subscriptionId: { not: null }, status: "PAID", paidAt: { gte: start, lte: end }, OR: [{ barbershopId }, { subscription: { barbershopId } }] },
        select: POOL_PAYMENT_SELECT,
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", subscriptionId: null, date: { gte: start, lte: end } },
        include: { service: true, client: { select: { name: true } } },
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
    const totalSubRevenue = poolRevenue(subPayments);
    // Cada serviço do plano realizado conta 1 (Corte + Barba = 2 serviços)
    const totalSubServicos = poolServices(allSubAppointments);
    const pool = poolOf(totalSubRevenue, totalSubServicos, shop);
    const ticketMedioSub = pool.ticket;

    // ── Agrupamento em memória por barbeiro ──
    const result = barbers.map((b) => {
      const avulsos = allAvulsos.filter((a) => a.barberId === b.id);
      const subAppointments = allSubAppointments.filter((a) => a.barberId === b.id);
      const productSales = allProductSales.filter((p) => p.barberId === b.id);
      const vales = allVales.filter((v) => v.barberId === b.id);
      const reviews = allReviews.filter((r) => r.barberId === b.id);
      const standardPayment = allCommissionPayments.find((cp) => cp.barberId === b.id && cp.type === "STANDARD") ?? null;
      const subscriptionPayment = allCommissionPayments.find((cp) => cp.barberId === b.id && cp.type === "SUBSCRIPTION") ?? null;

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
      const comissaoExtra = extraAppts.reduce(
        (s, a) => s + calcComissao(a.extraPrice ?? 0, b.commissionType, b.commission),
        0
      );

      const comissaoAvulsoBase = avulsos.reduce((s, a) => {
        const materialCost = a.service?.materialCost || 0;
        const netValue = Math.max(0, a.price - materialCost);
        const hasCustomCommission = a.service?.commission !== null && a.service?.commission !== undefined;
        if (hasCustomCommission) return s + calcComissao(netValue, "PERCENTAGE", a.service!.commission!);
        return s + calcComissao(netValue, b.commissionType, b.commission);
      }, 0);
      const comissaoAvulso = comissaoAvulsoBase + comissaoExtra;

      const comissaoAssinatura = subAppointments.reduce((s, a) => s + subscriptionCommission(a, ticketMedioSub), 0);
      // Separação para exibir: o que veio do pote (ticket × serviços) e o que veio de plano
      // com comissão própria (% do plano). Não muda o valor, só mostra de onde ele vem.
      const ownPlan = (a: (typeof subAppointments)[number]) => a.subscription?.plan?.commissionPercentage != null;
      const servicosPote = subAppointments.filter((a) => !ownPlan(a)).reduce((s, a) => s + countPlanServices(a), 0);
      const servicosProprio = subAppointments.filter(ownPlan).reduce((s, a) => s + countPlanServices(a), 0);
      const comissaoProprio = subAppointments.filter(ownPlan).reduce((s, a) => s + subscriptionCommission(a, ticketMedioSub), 0);

      const totalProdutos = productSales.reduce((s, p) => s + p.total, 0);
      const comissaoProdutos = productSales.reduce((s, p) => {
        const commType = p.product?.commissionType || b.productCommissionType;
        const commValue =
          p.product?.commissionValue !== undefined && p.product?.commissionValue !== null
            ? p.product.commissionValue
            : b.productCommission;
        if (commType === "FIXED") return s + commValue * p.quantity;
        return s + calcComissao(p.total, commType, commValue);
      }, 0);

      const totalComissao = comissaoAvulso + comissaoAssinatura + comissaoProdutos;
      const totalVales = vales.reduce((s, v) => s + v.amount, 0);
      // Gorjeta é 100% do barbeiro (avulsos e assinantes) e vai junto no acerto avulso.
      const gorjetaAppts = [...avulsos, ...subAppointments].filter((a) => (a.tipAmount ?? 0) > 0);
      const totalGorjetas = gorjetaAppts.reduce((s, a) => s + a.tipAmount, 0);
      const liquidoAPagar = Math.max(0, comissaoAvulso + comissaoProdutos + totalGorjetas - totalVales);
      const liquidoAssinatura = comissaoAssinatura;

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
        paid: standardPayment ? { paidAt: standardPayment.paidAt, amount: standardPayment.amount } : null,
        subPaid: subscriptionPayment ? { paidAt: subscriptionPayment.paidAt, amount: subscriptionPayment.amount } : null,
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
