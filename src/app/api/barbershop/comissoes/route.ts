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

    // 10 queries globais em paralelo (antes: 3 sequenciais + N*7 no loop por barbeiro)
    const [
      barbers,
      subPayments,
      allSubAppointmentsCount,
      allAvulsos,
      allSubAppointments,
      allProductSales,
      allCommissionPayments,
      allVales,
      allReviews,
    ] = await Promise.all([
      prisma.barber.findMany({
        where: { barbershopId, active: true },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.payment.findMany({
        where: { barbershopId, subscriptionId: { not: null }, status: "PAID", paidAt: { gte: start, lte: end } },
        select: { amount: true },
      }),
      prisma.appointment.count({
        where: { barbershopId, subscriptionId: { not: null }, status: "DONE", date: { gte: start, lte: end } },
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", subscriptionId: null, date: { gte: start, lte: end } },
        select: {
          barberId: true, price: true,
          service: { select: { materialCost: true, commission: true } },
        },
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", subscriptionId: { not: null }, date: { gte: start, lte: end } },
        select: {
          barberId: true, price: true,
          service: { select: { materialCost: true } },
          subscription: { select: { plan: { select: { commissionPercentage: true } } } },
        },
      }),
      prisma.productSale.findMany({
        where: { barbershopId, createdAt: { gte: start, lte: end } },
        select: {
          barberId: true, total: true, quantity: true,
          product: { select: { commissionType: true, commissionValue: true } },
        },
      }),
      prisma.commissionPayment.findMany({
        where: { barbershopId, month: monthKey },
        select: { barberId: true, type: true, paidAt: true, amount: true },
      }),
      prisma.commissionVale.findMany({
        where: { barbershopId, month: monthKey },
        orderBy: { createdAt: "asc" },
      }),
      prisma.review.findMany({
        where: { barbershopId, createdAt: { gte: start, lte: end } },
        select: { barberId: true, rating: true },
      }),
    ]);

    const totalSubRevenue = subPayments.reduce((s, p) => s + p.amount, 0);
    const poolBarbeiros = totalSubRevenue * 0.5;
    const ticketMedioSub = allSubAppointmentsCount > 0 ? poolBarbeiros / allSubAppointmentsCount : 0;

    // Indexa todas as listas por barberId — O(N) cada
    const avulsosByBarber = new Map<string, typeof allAvulsos>();
    for (const a of allAvulsos) {
      if (!a.barberId) continue;
      const list = avulsosByBarber.get(a.barberId) ?? [];
      list.push(a);
      avulsosByBarber.set(a.barberId, list);
    }
    const subApptsByBarber = new Map<string, typeof allSubAppointments>();
    for (const a of allSubAppointments) {
      if (!a.barberId) continue;
      const list = subApptsByBarber.get(a.barberId) ?? [];
      list.push(a);
      subApptsByBarber.set(a.barberId, list);
    }
    const productSalesByBarber = new Map<string, typeof allProductSales>();
    for (const p of allProductSales) {
      if (!p.barberId) continue;
      const list = productSalesByBarber.get(p.barberId) ?? [];
      list.push(p);
      productSalesByBarber.set(p.barberId, list);
    }
    const valesByBarber = new Map<string, typeof allVales>();
    for (const v of allVales) {
      const list = valesByBarber.get(v.barberId) ?? [];
      list.push(v);
      valesByBarber.set(v.barberId, list);
    }
    const reviewsByBarber = new Map<string, typeof allReviews>();
    for (const r of allReviews) {
      if (!r.barberId) continue;
      const list = reviewsByBarber.get(r.barberId) ?? [];
      list.push(r);
      reviewsByBarber.set(r.barberId, list);
    }
    const paymentsByBarber = new Map<string, { standard?: { paidAt: Date; amount: number }; subscription?: { paidAt: Date; amount: number } }>();
    for (const p of allCommissionPayments) {
      const entry = paymentsByBarber.get(p.barberId) ?? {};
      if (p.type === "STANDARD") entry.standard = { paidAt: p.paidAt, amount: p.amount };
      else if (p.type === "SUBSCRIPTION") entry.subscription = { paidAt: p.paidAt, amount: p.amount };
      paymentsByBarber.set(p.barberId, entry);
    }

    const result = barbers.map((b) => {
      const avulsos = avulsosByBarber.get(b.id) ?? [];
      const subAppointments = subApptsByBarber.get(b.id) ?? [];
      const productSales = productSalesByBarber.get(b.id) ?? [];
      const vales = valesByBarber.get(b.id) ?? [];
      const reviews = reviewsByBarber.get(b.id) ?? [];
      const payments = paymentsByBarber.get(b.id);

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
      for (const r of reviews) {
        if (r.rating >= 9) promoters++;
        else if (r.rating <= 6) detractors++;
      }
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
        avulso: { atendimentos: avulsos.length, faturado: totalAvulso, comissao: comissaoAvulso },
        assinatura: { servicos: subAppointments.length, ticketMedio: ticketMedioSub, comissao: comissaoAssinatura },
        produtos: { vendas: productSales.length, faturado: totalProdutos, comissao: comissaoProdutos },
        totalComissao,
        totalVales,
        liquidoAPagar,
        liquidoAssinatura,
        vales: vales.map((v) => ({ id: v.id, amount: v.amount, description: v.description, createdAt: v.createdAt })),
        paid: payments?.standard ?? null,
        subPaid: payments?.subscription ?? null,
        npsScore,
      };
    });

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
    requireAuth(req, ["OWNER"]);
    const {
      barberId,
      commissionType, commission,
      productCommissionType, productCommission,
    } = await req.json();

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
