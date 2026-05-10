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
          service: { select: { name: true } },
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
          service: { select: { name: true } },
          subscription: { include: { plan: { select: { name: true } } } },
        },
        orderBy: { date: "desc" },
      }),
      prisma.productSale.findMany({
        where: {
          barberId: barber.id,
          createdAt: { gte: start, lte: end },
        },
        include: {
          product: { select: { name: true } },
          client: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Avulso
    const avulsoItems = avulsos.map((a) => ({
      id: a.id,
      date: a.date,
      time: a.startTime,
      client: a.client.name,
      service: a.service.name,
      valor: a.price,
      comissao: calcComissao(a.price, barber.commissionType, barber.commission),
      tipo: "avulso" as const,
    }));
    const totalAvulsoFaturado = avulsos.reduce((s, a) => s + a.price, 0);
    const totalAvulsoComissao = avulsoItems.reduce((s, i) => s + i.comissao, 0);

    // Assinatura
    const assinaturaItems = subAppointments.map((a) => ({
      id: a.id,
      date: a.date,
      time: a.startTime,
      client: a.client.name,
      service: a.service.name,
      plano: a.subscription?.plan.name ?? "Assinatura",
      valor: a.price,
      comissao: calcComissao(a.price, barber.commissionType, barber.commission),
      tipo: "assinatura" as const,
    }));
    const totalAssinaturaFaturado = subAppointments.reduce((s, a) => s + a.price, 0);
    const totalAssinaturaComissao = assinaturaItems.reduce((s, i) => s + i.comissao, 0);

    // Produtos
    const produtoItems = productSales.map((p) => ({
      id: p.id,
      date: p.createdAt,
      client: p.client?.name ?? "—",
      product: p.product.name,
      qty: p.quantity,
      valor: p.total,
      comissao: calcComissao(p.total, barber.productCommissionType, barber.productCommission),
      tipo: "produto" as const,
    }));
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
