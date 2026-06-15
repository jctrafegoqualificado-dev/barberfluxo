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
    const payload = requireAuth(req, ["BARBER"]);
    const monthOffset = Number(req.nextUrl.searchParams.get("month") || "0");

    const barber = await prisma.barber.findUnique({
      where: { userId: payload.id },
      include: { user: { select: { name: true } } },
    });
    if (!barber) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });

    const refDate = subMonths(new Date(), monthOffset);
    const start = startOfMonth(refDate);
    const end = endOfMonth(refDate);
    const mesLabel = format(refDate, "MMMM yyyy", { locale: ptBR });

    // --- LÓGICA DE ASSINATURA SÊNIOR (Igual ao Admin) ---
    const subPayments = await prisma.payment.findMany({
      where: {
        barbershopId: barber.barbershopId,
        subscriptionId: { not: null },
        status: "PAID",
        paidAt: { gte: start, lte: end },
      }
    });
    const totalSubRevenue = subPayments.reduce((s, p) => s + p.amount, 0);
    const poolBarbeiros = totalSubRevenue * 0.5;

    const allSubAppointmentsCount = await prisma.appointment.count({
      where: {
        barbershopId: barber.barbershopId,
        subscriptionId: { not: null },
        status: "DONE",
        date: { gte: start, lte: end },
      }
    });
    const ticketMedioSub = allSubAppointmentsCount > 0 ? poolBarbeiros / allSubAppointmentsCount : 0;

    const [avulsos, subAppointments, productSales] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          barberId: barber.id,
          status: "DONE",
          subscriptionId: null,
          date: { gte: start, lte: end },
        },
        include: {
          client: { select: { name: true } },
          service: { select: { name: true, materialCost: true, commission: true } },
        },
        orderBy: { date: "desc" },
      }),
      prisma.appointment.findMany({
        where: {
          barberId: barber.id,
          status: "DONE",
          subscriptionId: { not: null },
          date: { gte: start, lte: end },
        },
        include: {
          client: { select: { name: true } },
          service: { select: { name: true, materialCost: true } },
          subscription: { include: { plan: { select: { name: true, commissionPercentage: true } } } },
        },
        orderBy: { date: "desc" },
      }),
      prisma.productSale.findMany({
        where: {
          barberId: barber.id,
          createdAt: { gte: start, lte: end },
        },
        include: {
          product: { select: { name: true, commissionType: true, commissionValue: true } },
          client: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Avulso
    const avulsoItems = avulsos.map((a) => {
      const materialCost = a.service?.materialCost || 0;
      const netValue = Math.max(0, a.price - materialCost);
      const hasCustomCommission = a.service?.commission != null;
      // Serviços extras cobrados além do serviço principal (ex.: sobrancelha) comissionam pela taxa padrão do barbeiro
      const extraComm = (a.extraPrice ?? 0) > 0
        ? calcComissao(a.extraPrice ?? 0, barber.commissionType, barber.commission)
        : 0;
      const comissao = (hasCustomCommission
        ? calcComissao(netValue, "PERCENTAGE", a.service!.commission!)
        : calcComissao(netValue, barber.commissionType, barber.commission)) + extraComm;

      return {
        id: a.id,
        date: a.date,
        time: a.startTime,
        client: a.client.name,
        service: a.service?.name ?? "Serviço",
        valor: a.price,
        comissao,
        tipo: "avulso" as const,
      };
    });
    const totalAvulsoFaturado = avulsos.reduce((s, a) => s + a.price, 0);
    const totalAvulsoComissao = avulsoItems.reduce((s, i) => s + i.comissao, 0);

    // Assinatura
    const assinaturaItems = subAppointments.map((a) => {
      // Serviços extras fora do plano (ex.: sobrancelha) comissionam pela taxa padrão, além do ticket médio do pool
      const extraComm = (a.extraPrice ?? 0) > 0
        ? calcComissao(a.extraPrice ?? 0, barber.commissionType, barber.commission)
        : 0;
      let comissao = ticketMedioSub + extraComm;
      const customPlanCommission = a.subscription?.plan?.commissionPercentage;
      if (customPlanCommission != null) {
        const materialCost = a.service?.materialCost || 0;
        const netValue = Math.max(0, a.price - materialCost);
        comissao = calcComissao(netValue, "PERCENTAGE", customPlanCommission) + extraComm;
      }

      return {
        id: a.id,
        date: a.date,
        time: a.startTime,
        client: a.client.name,
        service: a.service?.name ?? "Serviço",
        plano: a.subscription?.plan.name ?? "Assinatura",
        valor: a.price,
        comissao,
        tipo: "assinatura" as const,
      };
    });
    const totalAssinaturaFaturado = subAppointments.reduce((s, a) => s + a.price, 0);
    const totalAssinaturaComissao = assinaturaItems.reduce((s, i) => s + i.comissao, 0);

    // Produtos
    const produtoItems = productSales.map((p) => {
      const commType = p.product?.commissionType || barber.productCommissionType;
      const commValue = (p.product?.commissionValue !== undefined && p.product?.commissionValue !== null)
        ? p.product.commissionValue
        : barber.productCommission;
      const comissao = commType === "FIXED"
        ? commValue * p.quantity
        : calcComissao(p.total, commType, commValue);
      return {
        id: p.id,
        date: p.createdAt,
        client: p.client?.name ?? "—",
        product: p.product.name,
        qty: p.quantity,
        valor: p.total,
        comissao,
        tipo: "produto" as const,
      };
    });
    const totalProdutoFaturado = productSales.reduce((s, p) => s + p.total, 0);
    const totalProdutoComissao = produtoItems.reduce((s, i) => s + i.comissao, 0);

    const totalComissao = totalAvulsoComissao + totalAssinaturaComissao + totalProdutoComissao;

    return NextResponse.json({
      barber: {
        name: barber.user.name,
        commissionType: barber.commissionType,
        commission: barber.commission,
        productCommissionType: barber.productCommissionType,
        productCommission: barber.productCommission,
      },
      mes: mesLabel,
      monthOffset,
      resumo: {
        avulso: { atendimentos: avulsos.length, faturado: totalAvulsoFaturado, comissao: totalAvulsoComissao },
        assinatura: { atendimentos: subAppointments.length, faturado: totalAssinaturaFaturado, comissao: totalAssinaturaComissao },
        produtos: { vendas: productSales.length, faturado: totalProdutoFaturado, comissao: totalProdutoComissao },
        totalComissao,
      },
      itens: {
        avulso: avulsoItems,
        assinatura: assinaturaItems,
        produtos: produtoItems,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
