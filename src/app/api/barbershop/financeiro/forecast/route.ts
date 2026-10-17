import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { addMonth, currentMonthSP, monthStartSP } from "@/lib/monthResult";
import { appointmentRevenue } from "@/lib/finance";

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
    const currentMonth = currentMonthSP(now);
    const threeMonthsAgo = monthStartSP(addMonth(currentMonth, -3));
    const startOfCurrentMonth = monthStartSP(currentMonth);

    const appointments = await prisma.appointment.findMany({
      where: {
        barbershopId,
        status: "DONE",
        date: { gte: threeMonthsAgo, lt: startOfCurrentMonth },
      },
      select: { price: true, paymentMethod: true, subscriptionId: true, extraPrice: true, extraPaymentMethod: true, tipAmount: true, tipPaymentMethod: true, date: true },
    });

    // Agrupa por mês YYYY-MM
    const byMonth: Record<string, number> = {};
    for (const a of appointments) {
      const key = a.date.toISOString().slice(0, 7);
      // O que o atendimento trouxe de fato (assinante: só o extra; o plano está no MRR)
      byMonth[key] = (byMonth[key] ?? 0) + appointmentRevenue(a);
    }
    const monthTotals = Object.values(byMonth);
    const historicalMonths = monthTotals.length || 1;
    const avgMonthlyServices = monthTotals.length > 0
      ? monthTotals.reduce((s, v) => s + v, 0) / historicalMonths
      : 0;

    // ── 3. Despesas recorrentes fixas ───────────────────────────────────────
    // Cada mês de uma despesa recorrente é uma linha própria: conta só as deste mês
    // (antes somava todas as cópias — uma conta lançada por 12 meses entrava 12 vezes).
    const fixedExpenses = await prisma.expense.findMany({
      where: { barbershopId, isRecurring: true, type: "FIXED", month: currentMonth },
      select: { amount: true },
    });
    const monthlyFixedExpenses = fixedExpenses.reduce((s, e) => s + e.amount, 0);

    // Média de despesas variáveis dos últimos 3 meses
    const lastThreeMonths = [-2, -1, 0].map((offset) => addMonth(currentMonth, offset));
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
