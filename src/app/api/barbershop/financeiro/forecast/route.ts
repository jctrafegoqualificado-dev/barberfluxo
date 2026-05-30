import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const now = new Date();

    // ── 1. MRR: assinaturas ativas ──────────────────────────────────────────
    const activeSubs = await prisma.subscription.findMany({
      where: { barbershopId, status: "ACTIVE" },
      select: { plan: { select: { price: true, billingCycle: true } } },
    });

    // Normaliza tudo para mensal
    const monthlyMRR = activeSubs.reduce((sum, s) => {
      const p = s.plan.price;
      if (s.plan.billingCycle === "QUARTERLY") return sum + p / 3;
      if (s.plan.billingCycle === "YEARLY") return sum + p / 12;
      return sum + p;
    }, 0);

    // ── 2. Média mensal de serviços (últimos 3 meses completos) ─────────────
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const appointments = await prisma.appointment.findMany({
      where: {
        barbershopId,
        status: "DONE",
        date: { gte: threeMonthsAgo, lt: startOfCurrentMonth },
      },
      select: { price: true, extraPrice: true, date: true },
    });

    // Agrupa por mês YYYY-MM
    const byMonth: Record<string, number> = {};
    for (const a of appointments) {
      const key = `${a.date.getFullYear()}-${String(a.date.getMonth() + 1).padStart(2, "0")}`;
      byMonth[key] = (byMonth[key] ?? 0) + (a.price ?? 0) + (a.extraPrice ?? 0);
    }
    const monthTotals = Object.values(byMonth);
    const historicalMonths = monthTotals.length || 1;
    const avgMonthlyServices = monthTotals.length > 0
      ? monthTotals.reduce((s, v) => s + v, 0) / historicalMonths
      : 0;

    // ── 3. Despesas recorrentes fixas ───────────────────────────────────────
    const fixedExpenses = await prisma.expense.findMany({
      where: { barbershopId, isRecurring: true, type: "FIXED" },
      select: { amount: true },
    });
    const monthlyFixedExpenses = fixedExpenses.reduce((s, e) => s + e.amount, 0);

    // Média de despesas variáveis dos últimos 3 meses
    const lastThreeMonths = [-2, -1, 0].map((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const varExpenses = await prisma.expense.findMany({
      where: {
        barbershopId,
        type: { not: "FIXED" },
        month: { in: lastThreeMonths },
      },
      select: { amount: true },
    });
    const avgMonthlyVarExpenses = varExpenses.reduce((s, e) => s + e.amount, 0) / 3;
    const avgMonthlyExpenses = monthlyFixedExpenses + avgMonthlyVarExpenses;

    // ── 4. Projeções 30 / 60 / 90 dias ─────────────────────────────────────
    const periods = [30, 60, 90].map((days) => {
      const months = days / 30;
      const mrrPortion = monthlyMRR * months;
      const servicesPortion = avgMonthlyServices * months;
      const revenue = mrrPortion + servicesPortion;
      const expenses = avgMonthlyExpenses * months;
      const net = revenue - expenses;
      return { days, label: `${days} dias`, mrrPortion, servicesPortion, revenue, expenses, net };
    });

    return NextResponse.json({
      breakdown: {
        monthlyMRR,
        activeSubscriptions: activeSubs.length,
        avgMonthlyServices,
        monthlyFixedExpenses,
        avgMonthlyVarExpenses,
        avgMonthlyExpenses,
        historicalMonths,
      },
      periods,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
