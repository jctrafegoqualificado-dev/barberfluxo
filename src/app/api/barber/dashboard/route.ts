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
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [todayAppts, monthAppts, productSalesMonth] = await Promise.all([
      prisma.appointment.findMany({
        where: { barberId: barber.id, date: { gte: todayStart, lte: todayEnd } },
        include: {
          client: { select: { name: true, phone: true } },
          service: { select: { name: true, duration: true } },
          subscription: { include: { plan: { select: { name: true } } } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.appointment.findMany({
        where: { barberId: barber.id, date: { gte: monthStart, lte: monthEnd }, status: "DONE" },
        select: { price: true, subscriptionId: true },
      }),
      prisma.productSale.findMany({
        where: { barberId: barber.id, createdAt: { gte: monthStart, lte: monthEnd } },
        select: { total: true },
      }),
    ]);

    function calcComissao(valor: number, type: string, rate: number) {
      return type === "FIXED" ? rate : valor * (rate / 100);
    }

    const monthFaturado = monthAppts.reduce((s, a) => s + a.price, 0);
    const monthComissao = monthAppts.reduce((s, a) =>
      s + calcComissao(a.price, barber.commissionType, barber.commission), 0)
      + productSalesMonth.reduce((s, p) =>
      s + calcComissao(p.total, barber.productCommissionType, barber.productCommission), 0);

    const todayDone = todayAppts.filter((a) => a.status === "DONE");
    const todayFaturado = todayDone.reduce((s, a) => s + a.price, 0);
    const noShowToday = todayAppts.filter((a) => a.status === "NO_SHOW").length;

    // Próximo agendamento confirmado
    const nowTime = now.getHours() * 60 + now.getMinutes();
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
