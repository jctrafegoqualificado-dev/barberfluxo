import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["BARBER", "OWNER"]);
    const barber = await prisma.barber.findUnique({
      where: { userId: payload.id },
      include: { user: { select: { name: true } } },
    });
    if (!barber) return NextResponse.json({ error: "Perfil de barbeiro não encontrado" }, { status: 404 });

    const now = new Date();
    // Use Brazil timezone so queries stay correct after 21:00 BRT (UTC+0 server)
    const brDateStr = new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(now);
    const [brYear, brMonth, brDay] = brDateStr.split("-").map(Number);
    const todayStart = new Date(Date.UTC(brYear, brMonth - 1, brDay, 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(brYear, brMonth - 1, brDay, 23, 59, 59, 999));
    const monthStart = new Date(Date.UTC(brYear, brMonth - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(brYear, brMonth - 1, new Date(brYear, brMonth, 0).getDate(), 23, 59, 59, 999));

    const [todayAppts, monthAppts, productSalesMonth, subPaymentsMonth, allSubApptsCount] = await Promise.all([
      prisma.appointment.findMany({
        where: { barberId: barber.id, date: { gte: todayStart, lte: todayEnd } },
        include: {
          client: { select: { name: true, phone: true } },
          service: { select: { name: true, duration: true } },
          subscription: { select: { id: true, status: true, plan: { select: { name: true, extraDiscount: true, planServices: { select: { serviceId: true } } } } } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.appointment.findMany({
        where: { barberId: barber.id, date: { gte: monthStart, lte: monthEnd }, status: "DONE" },
        select: { price: true, extraPrice: true, subscriptionId: true, service: { select: { materialCost: true, commission: true } } },
      }),
      prisma.productSale.findMany({
        where: { barberId: barber.id, createdAt: { gte: monthStart, lte: monthEnd } },
        select: { total: true, quantity: true, product: { select: { commissionType: true, commissionValue: true } } },
      }),
      prisma.payment.findMany({
        where: { barbershopId: barber.barbershopId, subscriptionId: { not: null }, status: "PAID", paidAt: { gte: monthStart, lte: monthEnd } },
        select: { amount: true },
      }),
      prisma.appointment.count({
        where: { barbershopId: barber.barbershopId, subscriptionId: { not: null }, status: "DONE", date: { gte: monthStart, lte: monthEnd } },
      }),
    ]);

    function calcComissao(valor: number, type: string, rate: number) {
      return type === "FIXED" ? rate : valor * (rate / 100);
    }

    // Pool de assinatura (mesma lógica do relatório de comissões)
    const totalSubRevenue = subPaymentsMonth.reduce((s, p) => s + p.amount, 0);
    const ticketMedioSub = allSubApptsCount > 0 ? (totalSubRevenue * 0.5) / allSubApptsCount : 0;

    const monthFaturado = monthAppts.reduce((s, a) => s + a.price, 0);
    const monthComissaoServicos = monthAppts.reduce((s, a) => {
      const extraComm = (a.extraPrice ?? 0) > 0
        ? calcComissao(a.extraPrice ?? 0, barber.commissionType, barber.commission)
        : 0;

      // Assinante: comissão pelo pool (ticketMédio), não pelo preço cheio do serviço
      if (a.subscriptionId) {
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
    
    const monthComissaoProdutos = productSalesMonth.reduce((s, p) => {
      const commType = p.product?.commissionType || barber.productCommissionType;
      const commValue = p.product?.commissionValue !== undefined && p.product?.commissionValue !== null 
        ? p.product.commissionValue 
        : barber.productCommission;
      
      if (commType === "FIXED") {
        return s + (commValue * p.quantity);
      }
      return s + calcComissao(p.total, commType, commValue);
    }, 0);
    
    const monthComissao = monthComissaoServicos + monthComissaoProdutos;

    const todayDone = todayAppts.filter((a) => a.status === "DONE");
    const todayFaturado = todayDone.reduce((s, a) => s + a.price, 0);
    const noShowToday = todayAppts.filter((a) => a.status === "NO_SHOW").length;

    // Próximo agendamento confirmado — usa hora Brazil para comparar com startTime (HH:MM)
    const brTimeStr = new Intl.DateTimeFormat("en", {
      timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);
    const [brH, brM] = brTimeStr.split(":").map(Number);
    const nowTime = brH * 60 + brM;
    const proximoAgendamento = todayAppts.find((a) => {
      if (a.status !== "CONFIRMED") return false;
      const [h, m] = a.startTime.split(":").map(Number);
      return h * 60 + m >= nowTime;
    }) ?? null;

    return NextResponse.json({
      barberName: barber.user.name,
      hoje: {
        total: todayAppts.length,
        done: todayDone.length,
        pending: todayAppts.filter((a) => a.status === "CONFIRMED" || a.status === "PENDING").length,
        noShow: noShowToday,
        faturado: todayFaturado,
      },
      mes: {
        atendimentos: monthAppts.length,
        faturado: monthFaturado,
        comissao: monthComissao,
        avulso: monthAppts.filter((a) => !a.subscriptionId).length,
        assinatura: monthAppts.filter((a) => a.subscriptionId).length,
      },
      agenda: todayAppts,
      proximoAgendamento,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
