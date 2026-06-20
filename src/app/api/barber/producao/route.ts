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

    const [appointments, productSales, subPaymentsMonth, allSubApptsCount] = await Promise.all([
      prisma.appointment.findMany({
        where: { barberId: barber.id, date: { gte: start, lte: end } },
        include: {
          service: { select: { name: true, materialCost: true, commission: true } },
          subscription: { include: { plan: { select: { commissionPercentage: true } } } },
        },
        orderBy: { date: "asc" },
      }),
      prisma.productSale.findMany({
        where: { barberId: barber.id, createdAt: { gte: start, lte: end } },
        include: { product: { select: { name: true, commissionType: true, commissionValue: true } } },
      }),
      prisma.payment.findMany({
        where: { barbershopId: barber.barbershopId, subscriptionId: { not: null }, status: "PAID", paidAt: { gte: start, lte: end } },
        select: { amount: true },
      }),
      prisma.appointment.count({
        where: { barbershopId: barber.barbershopId, subscriptionId: { not: null }, status: "DONE", date: { gte: start, lte: end } },
      }),
    ]);

    // Pool de assinatura (mesma lógica do relatório de comissões)
    const totalSubRevenue = subPaymentsMonth.reduce((s, p) => s + p.amount, 0);
    const ticketMedioSub = allSubApptsCount > 0 ? (totalSubRevenue * 0.5) / allSubApptsCount : 0;

    const done = appointments.filter((a) => a.status === "DONE");
    const noShow = appointments.filter((a) => a.status === "NO_SHOW").length;
    const cancelled = appointments.filter((a) => a.status === "CANCELLED").length;
    const totalFaturado = done.reduce((s, a) => s + a.price, 0);
    const comissaoServicos = done.reduce((s, a) => {
      // Serviço extra (ex.: sobrancelha/hidratação) comissiona como avulso pela taxa padrão
      const extraComm = (a.extraPrice ?? 0) > 0
        ? calcComissao(a.extraPrice ?? 0, barber.commissionType, barber.commission)
        : 0;

      // Assinante: comissão pelo pool (ticket médio), descontando o extra do preço base
      if (a.subscriptionId) {
        const customPlanCommission = a.subscription?.plan?.commissionPercentage;
        if (customPlanCommission != null) {
          const materialCost = a.service?.materialCost || 0;
          const baseSubPrice = Math.max(0, a.price - (a.extraPrice ?? 0));
          const netValue = Math.max(0, baseSubPrice - materialCost);
          return s + calcComissao(netValue, "PERCENTAGE", customPlanCommission) + extraComm;
        }
        return s + ticketMedioSub + extraComm;
      }

      // Avulso: comissão normal sobre o preço do serviço
      const materialCost = a.service?.materialCost || 0;
      const netValue = Math.max(0, a.price - materialCost);
      const hasCustomCommission = a.service?.commission !== null && a.service?.commission !== undefined;
      const baseComm = hasCustomCommission
        ? calcComissao(netValue, "PERCENTAGE", a.service!.commission!)
        : calcComissao(netValue, barber.commissionType, barber.commission);
      return s + baseComm + extraComm;
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
