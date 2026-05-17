import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfMonth, endOfMonth, subMonths, eachDayOfInterval, format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

    function calcComissao(valor: number, type: string, rate: number) {
      return type === "FIXED" ? rate : valor * (rate / 100);
    }

    const [appointments, productSales] = await Promise.all([
      prisma.appointment.findMany({
        where: { barberId: barber.id, date: { gte: start, lte: end } },
        include: { service: { select: { name: true, materialCost: true, commission: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.productSale.findMany({
        where: { barberId: barber.id, createdAt: { gte: start, lte: end } },
        include: { product: { select: { name: true, commissionType: true, commissionValue: true } } },
      }),
    ]);

    const done = appointments.filter((a) => a.status === "DONE");
    const noShow = appointments.filter((a) => a.status === "NO_SHOW").length;
    const cancelled = appointments.filter((a) => a.status === "CANCELLED").length;
    const totalFaturado = done.reduce((s, a) => s + a.price, 0);
    const comissaoServicos = done.reduce((s, a) => {
      const materialCost = a.service?.materialCost || 0;
      const netValue = Math.max(0, a.price - materialCost);
      const hasCustomCommission = a.service?.commission !== null && a.service?.commission !== undefined;
      
      if (hasCustomCommission) {
        return s + calcComissao(netValue, "PERCENTAGE", a.service!.commission!);
      }
      return s + calcComissao(netValue, barber.commissionType, barber.commission);
    }, 0);
    
    const comissaoProdutos = productSales.reduce((s, p) => {
      const commType = p.product?.commissionType || barber.productCommissionType;
      const commValue = p.product?.commissionValue !== undefined && p.product?.commissionValue !== null 
        ? p.product.commissionValue 
        : barber.productCommission;
      
      if (commType === "FIXED") {
        return s + (commValue * p.quantity);
      }
      return s + calcComissao(p.total, commType, commValue);
    }, 0);
    const totalComissao = comissaoServicos + comissaoProdutos;

    // Ranking de serviços
    const serviceMap: Record<string, { name: string; count: number; faturado: number }> = {};
    for (const a of done) {
      const sid = a.serviceId ?? "unknown";
      const sname = a.service?.name ?? "Serviço removido";
      if (!serviceMap[sid]) serviceMap[sid] = { name: sname, count: 0, faturado: 0 };
      serviceMap[sid].count++;
      serviceMap[sid].faturado += a.price;
    }
    const servicosRanking = Object.values(serviceMap).sort((a, b) => b.count - a.count);

    // Produção diária (apenas dias com atendimentos)
    const days = eachDayOfInterval({ start, end });
    const producaoDiaria = days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayAppts = done.filter((a) => format(new Date(a.date), "yyyy-MM-dd") === dayStr);
      return {
        data: dayStr,
        label: format(day, "dd/MM"),
        diaSemana: format(day, "EEE", { locale: ptBR }),
        atendimentos: dayAppts.length,
        faturado: dayAppts.reduce((s, a) => s + a.price, 0),
      };
    }).filter((d) => d.atendimentos > 0);

    // Taxa de comparecimento
    const totalAgendados = appointments.length;
    const taxaComparecimento = totalAgendados > 0
      ? Math.round((done.length / totalAgendados) * 100)
      : null;

    return NextResponse.json({
      mes: mesLabel,
      monthOffset,
      barber: {
        commissionType: barber.commissionType,
        commission: barber.commission,
        productCommissionType: barber.productCommissionType,
        productCommission: barber.productCommission,
      },
      kpis: {
        atendimentos: done.length,
        totalAgendados,
        noShow,
        cancelled,
        taxaComparecimento,
        faturado: totalFaturado,
        comissaoServicos,
        comissaoProdutos,
        totalComissao,
        avulso: done.filter((a) => !a.subscriptionId).length,
        assinatura: done.filter((a) => a.subscriptionId).length,
        produtos: productSales.length,
        faturadoProdutos: productSales.reduce((s, p) => s + p.total, 0),
      },
      servicosRanking,
      producaoDiaria,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
