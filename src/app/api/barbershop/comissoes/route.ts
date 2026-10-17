import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { addMonth, currentMonthSP, monthStartSP } from "@/lib/monthResult";
import { computeCommissions } from "@/lib/commissions";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const monthOffset = Math.max(0, Number(req.nextUrl.searchParams.get("month") || "0"));
    const fromParam = req.nextUrl.searchParams.get("from");
    const toParam = req.nextUrl.searchParams.get("to");

    let start: Date, end: Date, mesLabel: string, monthKey: string;
    const current = currentMonthSP();
    let isCurrent = false;

    if (fromParam && toParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      // Período personalizado, em dias de São Paulo
      start = new Date(fromParam + "T00:00:00-03:00");
      end = new Date(new Date(toParam + "T00:00:00-03:00").getTime() + 86_400_000 - 1);
      const br = (d: string) => d.split("-").reverse().join("/");
      mesLabel = `${br(fromParam)} — ${br(toParam)}`;
      monthKey = `${fromParam}_${toParam}`;
    } else {
      monthKey = addMonth(current, -monthOffset);
      start = monthStartSP(monthKey);
      end = new Date(monthStartSP(addMonth(monthKey, 1)).getTime() - 1);
      const [y, m] = monthKey.split("-").map(Number);
      mesLabel = `${MONTHS[m - 1]} de ${y}`;
      isCurrent = monthKey === current;
    }

    const [{ barbers: result, totalSubRevenue, ticketMedioSub, pool }, paidHistory] = await Promise.all([
      computeCommissions(barbershopId, start, end, monthKey),
      // Meses anteriores já pagos (soma do que foi registrado como pago em cada mês)
      prisma.commissionPayment.findMany({
        where: { barbershopId, month: { lt: monthKey.slice(0, 7) } },
        select: { month: true, amount: true, barberId: true, paidAt: true },
        orderBy: { month: "desc" },
        take: 300,
      }),
    ]);

    const byMonth = new Map<string, { month: string; total: number; barbers: Set<string>; paidAt: Date }>();
    for (const p of paidHistory) {
      if (!/^\d{4}-\d{2}$/.test(p.month)) continue;
      const cur = byMonth.get(p.month) ?? { month: p.month, total: 0, barbers: new Set<string>(), paidAt: p.paidAt };
      cur.total += p.amount;
      cur.barbers.add(p.barberId);
      if (p.paidAt > cur.paidAt) cur.paidAt = p.paidAt;
      byMonth.set(p.month, cur);
    }
    const history = [...byMonth.values()].slice(0, 6).map((h) => ({
      month: h.month, total: Math.round(h.total * 100) / 100, barbers: h.barbers.size, paidAt: h.paidAt,
    }));

    return NextResponse.json({
      barbers: result, mes: mesLabel, monthOffset, monthKey, isCurrent,
      periodStart: start.toISOString(), periodEnd: end.toISOString(),
      progress: isCurrent ? Math.min(1, (Date.now() - start.getTime()) / (end.getTime() - start.getTime())) : 1,
      totalSubRevenue, ticketMedioSub, pool, history,
    });
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
