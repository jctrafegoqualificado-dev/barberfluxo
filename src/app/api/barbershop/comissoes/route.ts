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
    const fromParam = req.nextUrl.searchParams.get("from");
    const toParam = req.nextUrl.searchParams.get("to");

    let start: Date, end: Date, mesLabel: string, monthKey: string;

    if (fromParam && toParam) {
      start = new Date(fromParam + "T00:00:00");
      end = new Date(toParam + "T23:59:59");
      mesLabel = `${format(start, "dd/MM/yyyy")} — ${format(end, "dd/MM/yyyy")}`;
      monthKey = `${fromParam}_${toParam}`;
    } else {
      const refDate = subMonths(new Date(), monthOffset);
      start = startOfMonth(refDate);
      end = endOfMonth(refDate);
      mesLabel = format(refDate, "MMMM yyyy", { locale: ptBR });
      monthKey = format(refDate, "yyyy-MM");
    }

    const barbers = await prisma.barber.findMany({
      where: { barbershopId, active: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (barbers.length === 0) {
      return NextResponse.json({ barbers: [], mes: mesLabel, monthOffset, monthKey, totalSubRevenue: 0, ticketMedioSub: 0 });
    }

    const [subPayments, allAvulsos, allSubAppointments, allProductSales, allCommissionPayments, allVales, allReviews] = await Promise.all([
      prisma.payment.findMany({
        where: { barbershopId, subscriptionId: { not: null }, status: "PAID", paidAt: { gte: start, lte: end } },
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", subscriptionId: null, date: { gte: start, lte: end } },
        include: { service: true, client: { select: { name: true } } },
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", subscriptionId: { not: null }, date: { gte: start, lte: end } },
        include: { service: true, client: { select: { name: true } }, subscription: { include: { plan: true } } },
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
    const totalSubRevenue = subPayments.reduce((s, p) => s + p.amount, 0);
    const poolBarbeiros = totalSubRevenue * 0.5;
    const ticketMedioSub = allSubAppointments.length > 0 ? poolBarbeiros / allSubAppointments.length : 0;

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

      const comissaoAssinatura = subAppointments.reduce((s, a) => {
        const baseSubPrice = Math.max(0, a.price - (a.extraPrice ?? 0));
        const customPlanCommission = a.subscription?.plan?.commissionPercentage;
        if (customPlanCommission != null) {
          const materialCost = a.service?.materialCost || 0;
          const netValue = Math.max(0, baseSubPrice - materialCost);
          return s + calcComissao(netValue, "PERCENTAGE", customPlanCommission);
        }
        return s + ticketMedioSub;
      }, 0);

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
      const liquidoAPagar = Math.max(0, comissaoAvulso + comissaoProdutos - totalVales);
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
          servicos: subAppointments.length,
          ticketMedio: ticketMedioSub,
          comissao: comissaoAssinatura,
          items: subAppointments.map((a) => ({
            date: a.date.toISOString(),
            clientName: a.client?.name ?? "—",
            serviceName: a.service?.name ?? "—",
            price: Math.max(0, a.price - (a.extraPrice ?? 0)),
          })),
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
        paid: standardPayment ? { paidAt: standardPayment.paidAt, amount: standardPayment.amount } : null,
        subPaid: subscriptionPayment ? { paidAt: subscriptionPayment.paidAt, amount: subscriptionPayment.amount } : null,
        npsScore,
      };
    });

    return NextResponse.json({ barbers: result, mes: mesLabel, monthOffset, monthKey, totalSubRevenue, ticketMedioSub });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
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
