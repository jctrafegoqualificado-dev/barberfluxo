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

    const result = await Promise.all(barbers.map(async (b) => {
      const [avulsos, subAppointments, productSales, commissionPayment, vales] = await Promise.all([
        prisma.appointment.findMany({
          where: {
            barberId: b.id,
            status: "DONE",
            subscriptionId: null,
            date: { gte: start, lte: end },
          },
          include: { service: true },
        }),
        prisma.appointment.findMany({
          where: {
            barberId: b.id,
            status: "DONE",
            subscriptionId: { not: null },
            date: { gte: start, lte: end },
          },
          include: { service: true },
        }),
        prisma.productSale.findMany({
          where: {
            barberId: b.id,
            createdAt: { gte: start, lte: end },
          },
          include: { product: true },
        }),
        prisma.commissionPayment.findUnique({
          where: { barberId_month: { barberId: b.id, month: monthKey } },
        }),
        prisma.commissionVale.findMany({
          where: { barberId: b.id, month: monthKey },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      const totalAvulso = avulsos.reduce((s, a) => s + a.price, 0);
      const comissaoAvulso = avulsos.reduce((s, a) =>
        s + calcComissao(a.price, b.commissionType, b.commission), 0);

      const totalAssinatura = subAppointments.reduce((s, a) => s + a.price, 0);
      const comissaoAssinatura = subAppointments.reduce((s, a) =>
        s + calcComissao(a.price, b.commissionType, b.commission), 0);

      const totalProdutos = productSales.reduce((s, p) => s + p.total, 0);
      const comissaoProdutos = productSales.reduce((s, p) =>
        s + calcComissao(p.total, b.productCommissionType, b.productCommission), 0);

      const totalComissao = comissaoAvulso + comissaoAssinatura + comissaoProdutos;
      const totalVales = vales.reduce((s, v) => s + v.amount, 0);
      const liquidoAPagar = Math.max(0, totalComissao - totalVales);

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
          faturado: totalAssinatura,
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
        vales: vales.map((v) => ({ id: v.id, amount: v.amount, description: v.description, createdAt: v.createdAt })),
        paid: commissionPayment
          ? { paidAt: commissionPayment.paidAt, amount: commissionPayment.amount }
          : null,
      };
    }));

    return NextResponse.json({ barbers: result, mes: mesLabel, monthOffset, monthKey });
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
