import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

function calcComissao(valor: number, type: string, rate: number): number {
  if (type === "FIXED") return rate;
  return valor * (rate / 100);
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const monthOffset = Number(req.nextUrl.searchParams.get("month") || "0");

    const refDate = subMonths(new Date(), monthOffset);
    const start = startOfMonth(refDate);
    const end = endOfMonth(refDate);
    const mesLabel = format(refDate, "MMMM yyyy", { locale: ptBR });
    const monthKey = format(refDate, "yyyy-MM");

    const barbers = await prisma.barber.findMany({
      where: { barbershopId, active: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // --- LÓGICA DE ASSINATURA SÊNIOR ---
    // 1. Faturamento Total de Assinaturas (Pagamentos Recebidos no mês)
    const subPayments = await prisma.payment.findMany({
      where: {
        barbershopId,
        subscriptionId: { not: null },
        status: "PAID",
        paidAt: { gte: start, lte: end },
      }
    });
    const totalSubRevenue = subPayments.reduce((s, p) => s + p.amount, 0);
    const poolBarbeiros = totalSubRevenue * 0.5;

    // 2. Total de Atendimentos via Assinatura (Todos os barbeiros)
    const allSubAppointmentsCount = await prisma.appointment.count({
      where: {
        barbershopId,
        subscriptionId: { not: null },
        status: "DONE",
        date: { gte: start, lte: end },
      }
    });

    // 3. Ticket Médio da Assinatura (R$ por atendimento)
    const ticketMedioSub = allSubAppointmentsCount > 0 ? poolBarbeiros / allSubAppointmentsCount : 0;

    const result = await Promise.all(barbers.map(async (b) => {
      const [avulsos, subAppointments, productSales, standardPayment, subscriptionPayment, vales, reviews] = await Promise.all([
        prisma.appointment.findMany({
          where: {
            barberId: b.id,
            status: "DONE",
            subscriptionId: null,
            date: { gte: start, lte: end },
          },
          include: { service: true, client: { select: { name: true } } },
        }),
        prisma.appointment.findMany({
          where: {
            barberId: b.id,
            status: "DONE",
            subscriptionId: { not: null },
            date: { gte: start, lte: end },
          },
          include: { service: true, client: { select: { name: true } }, subscription: { include: { plan: true } } },
        }),
        prisma.productSale.findMany({
          where: {
            barberId: b.id,
            createdAt: { gte: start, lte: end },
          },
          include: { product: true },
        }),
        prisma.commissionPayment.findUnique({
          where: { barberId_month_type: { barberId: b.id, month: monthKey, type: "STANDARD" } },
        }),
        prisma.commissionPayment.findUnique({
          where: { barberId_month_type: { barberId: b.id, month: monthKey, type: "SUBSCRIPTION" } },
        }),
        prisma.commissionVale.findMany({
          where: { barberId: b.id, month: monthKey },
          orderBy: { createdAt: "asc" },
        }),
        prisma.review.findMany({
          where: { barberId: b.id, createdAt: { gte: start, lte: end } }
        }),
      ]);

      const totalAvulso = avulsos.reduce((s, a) => s + a.price, 0);
      const comissaoAvulso = avulsos.reduce((s, a) => {
        const materialCost = a.service?.materialCost || 0;
        const netValue = Math.max(0, a.price - materialCost);
        const hasCustomCommission = a.service?.commission !== null && a.service?.commission !== undefined;
        
        if (hasCustomCommission) {
          return s + calcComissao(netValue, "PERCENTAGE", a.service!.commission!);
        }
        return s + calcComissao(netValue, b.commissionType, b.commission);
      }, 0);

      // Nova regra: Comissao de Assinatura
      // Se o plano tiver uma comissão específica, usa ela sobre o valor nominal do serviço (descontando custo).
      // Se não, usa o Ticket Médio do Pool (rateio igualitário).
      const totalAssinatura = subAppointments.reduce((s, a) => s + a.price, 0); // Faturamento nominal (apenas para relatório)
      
      const comissaoAssinatura = subAppointments.reduce((s, a) => {
        const customPlanCommission = a.subscription?.plan?.commissionPercentage;
        if (customPlanCommission != null) {
          const materialCost = a.service?.materialCost || 0;
          const netValue = Math.max(0, a.price - materialCost);
          return s + calcComissao(netValue, "PERCENTAGE", customPlanCommission);
        }
        return s + ticketMedioSub;
      }, 0);

      const totalProdutos = productSales.reduce((s, p) => s + p.total, 0);
      const comissaoProdutos = productSales.reduce((s, p) => {
        const commType = p.product?.commissionType || b.productCommissionType;
        const commValue = p.product?.commissionValue !== undefined && p.product?.commissionValue !== null 
          ? p.product.commissionValue 
          : b.productCommission;
        
        if (commType === "FIXED") {
          return s + (commValue * p.quantity);
        }
        return s + calcComissao(p.total, commType, commValue);
      }, 0);

      const totalComissao = comissaoAvulso + comissaoAssinatura + comissaoProdutos;
      const totalVales = vales.reduce((s, v) => s + v.amount, 0);
      
      const liquidoAPagar = Math.max(0, comissaoAvulso + comissaoProdutos - totalVales);
      const liquidoAssinatura = comissaoAssinatura;

      let promoters = 0;
      let detractors = 0;
      reviews.forEach((r: any) => {
        if (r.rating >= 9) promoters++;
        else if (r.rating <= 6) detractors++;
      });
      const totalReviews = reviews.length;
      const npsScore = totalReviews > 0 ? Math.round(((promoters - detractors) / totalReviews) * 100) : null;

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
          faturado: totalAvulso,
          comissao: comissaoAvulso,
        },
        assinatura: {
          servicos: subAppointments.length,
          ticketMedio: ticketMedioSub, // Adicionado para transparência
          comissao: comissaoAssinatura,
        },
        produtos: {
          vendas: productSales.length,
          faturado: totalProdutos,
          comissao: comissaoProdutos,
        },
        totalComissao,
        totalVales,
        liquidoAPagar,
        liquidoAssinatura,
        vales: vales.map((v) => ({ id: v.id, amount: v.amount, description: v.description, createdAt: v.createdAt })),
        paid: standardPayment
          ? { paidAt: standardPayment.paidAt, amount: standardPayment.amount }
          : null,
        subPaid: subscriptionPayment
          ? { paidAt: subscriptionPayment.paidAt, amount: subscriptionPayment.amount }
          : null,
        npsScore,
      };
    }));

    return NextResponse.json({ 
      barbers: result, 
      mes: mesLabel, 
      monthOffset, 
      monthKey,
      totalSubRevenue, // Dados globais para o painel
      ticketMedioSub 
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const {
      barberId,
      commissionType, commission,
      productCommissionType, productCommission,
    } = await req.json();

    // Valida que o barbeiro pertence a esta barbearia antes de alterar taxas (CVE-8)
    const existing = await prisma.barber.findFirst({
      where: { id: barberId, barbershopId: payload.barbershopId! },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
    }

    const barber = await prisma.barber.update({
      where: { id: barberId },
      data: {
        commissionType,
        commission: Number(commission),
        productCommissionType,
        productCommission: Number(productCommission),
      },
    });
    return NextResponse.json({ barber });
  } catch (e: unknown) {
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}
