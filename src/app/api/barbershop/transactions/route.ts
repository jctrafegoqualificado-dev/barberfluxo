import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfMonth, endOfMonth, format, addMonths } from "date-fns";

const PAYMENT_LABELS: Record<string, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT: "Cartão de Crédito",
  DEBIT: "Cartão de Débito",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de Crédito",
  DEBIT_CARD: "Cartão de Débito",
};

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? format(new Date(), "yyyy-MM");
    const tab = searchParams.get("tab") ?? "all"; // all | income | expense | pending

    const monthStart = startOfMonth(new Date(month + "-15"));
    const monthEnd = endOfMonth(monthStart);

    const prevMonthStart = startOfMonth(addMonths(monthStart, -1));
    const prevMonthEnd = endOfMonth(prevMonthStart);
    const prevMonthStr = format(prevMonthStart, "yyyy-MM");

    // Todas as 5 queries em paralelo (antes eram 3 waves sequenciais)
    const [shop, appointments, expenses, prevAppts, prevExpenses] = await Promise.all([
      prisma.barbershop.findUnique({
        where: { id: barbershopId },
        select: { debitFee: true, creditFee: true },
      }),
      prisma.appointment.findMany({
        where: {
          barbershopId,
          status: "DONE",
          date: { gte: monthStart, lte: monthEnd },
        },
        select: {
          id: true,
          paymentMethod: true,
          price: true,
          date: true,
          subscriptionId: true,
          client: { select: { name: true } },
          service: { select: { name: true } },
          services: { select: { service: { select: { name: true } } } },
        },
        orderBy: { date: "desc" },
      }),
      prisma.expense.findMany({
        where: { barbershopId, month },
        orderBy: { createdAt: "desc" },
      }),
      prisma.appointment.aggregate({
        where: { barbershopId, status: "DONE", date: { gte: prevMonthStart, lte: prevMonthEnd } },
        _sum: { price: true },
      }),
      prisma.expense.aggregate({
        where: { barbershopId, month: prevMonthStr },
        _sum: { amount: true },
      }),
    ]);
    const debitFee = shop?.debitFee ?? 0;
    const creditFee = shop?.creditFee ?? 0;

    // ── 3. Build unified transaction list
    type Transaction = {
      id: string;
      type: "INCOME" | "EXPENSE";
      description: string;
      amount: number;
      fee: number;
      net: number;
      paymentMethod: string;
      paymentMethodLabel: string;
      status: string;
      date: string;
      category: string;
      clientOrBarber?: string;
    };

    const transactions: Transaction[] = [];

    // KPIs + avulso breakdown — 1 pass sobre appointments (antes: 3 passes)
    let totalReceitas = 0;
    let totalTaxas = 0;
    let taxasDebito = 0;
    let taxasCredito = 0;
    const avulsoByMethod: Record<string, { count: number; bruto: number; taxa: number; liquido: number }> = {};
    let avulsoBrutoTotal = 0;
    let avulsoLiquidoTotal = 0;

    for (const appt of appointments) {
      const method = appt.paymentMethod ?? "CASH";
      const isDebit = method === "DEBIT" || method === "DEBIT_CARD";
      const isCredit = method === "CREDIT" || method === "CREDIT_CARD";
      const feeRate = isDebit ? debitFee / 100 : isCredit ? creditFee / 100 : 0;
      const fee = appt.price * feeRate;

      totalReceitas += appt.price;
      totalTaxas += fee;
      if (isDebit) taxasDebito += fee;
      if (isCredit) taxasCredito += fee;

      if (!appt.subscriptionId) {
        if (!avulsoByMethod[method]) avulsoByMethod[method] = { count: 0, bruto: 0, taxa: 0, liquido: 0 };
        avulsoByMethod[method].count += 1;
        avulsoByMethod[method].bruto += appt.price;
        avulsoByMethod[method].taxa += fee;
        avulsoByMethod[method].liquido += appt.price - fee;
        avulsoBrutoTotal += appt.price;
        avulsoLiquidoTotal += appt.price - fee;
      }

      const serviceNames = appt.services?.length > 0
        ? appt.services.map((s) => s.service?.name ?? "Serviço").join(", ")
        : appt.service?.name ?? "Serviço";

      transactions.push({
        id: appt.id,
        type: "INCOME",
        description: `Atendimento — ${serviceNames}`,
        amount: appt.price,
        fee,
        net: appt.price - fee,
        paymentMethod: method,
        paymentMethodLabel: PAYMENT_LABELS[method] ?? method,
        status: "PAID",
        date: appt.date.toISOString(),
        category: "ATENDIMENTO",
        clientOrBarber: appt.client?.name ?? "Cliente",
      });
    }

    // KPIs + transactions de expenses — 1 pass
    let totalDespesas = 0;
    let despesasFixas = 0;
    let totalPendentes = 0;
    let countPending = 0;
    let countExpenseAll = 0;
    for (const exp of expenses) {
      totalDespesas += exp.amount;
      if (exp.type === "FIXED") despesasFixas += exp.amount;
      if (exp.status === "PENDING") {
        totalPendentes += exp.amount;
        countPending++;
      }
      if (exp.status === "OVERDUE") countPending++;
      countExpenseAll++;

      transactions.push({
        id: exp.id,
        type: "EXPENSE",
        description: exp.name,
        amount: exp.amount,
        fee: 0,
        net: exp.amount,
        paymentMethod: exp.paymentMethod ?? "PIX",
        paymentMethodLabel: PAYMENT_LABELS[exp.paymentMethod ?? "PIX"] ?? exp.paymentMethod ?? "PIX",
        status: exp.status,
        date: exp.dueDate?.toISOString() ?? exp.createdAt.toISOString(),
        category: exp.category,
        clientOrBarber: undefined,
      });
    }

    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const despesasVariaveis = totalDespesas - despesasFixas;
    const saldo = totalReceitas - totalTaxas - totalDespesas;

    // Filter by tab
    let filtered = transactions;
    if (tab === "income") filtered = transactions.filter(t => t.type === "INCOME");
    else if (tab === "expense") filtered = transactions.filter(t => t.type === "EXPENSE");
    else if (tab === "pending") filtered = transactions.filter(t => t.status === "PENDING" || t.status === "OVERDUE");

    const prevReceitas = prevAppts._sum.price ?? 0;
    const prevDespesas = prevExpenses._sum.amount ?? 0;

    return NextResponse.json({
      month,
      debitFee,
      creditFee,
      transactions: filtered,
      avulso: {
        bruto: avulsoBrutoTotal,
        liquido: avulsoLiquidoTotal,
        taxaTotal: avulsoBrutoTotal - avulsoLiquidoTotal,
        byMethod: avulsoByMethod,
      },
      kpis: {
        receitas: totalReceitas,
        despesas: totalDespesas,
        despesasFixas,
        despesasVariaveis,
        taxas: totalTaxas,
        taxasDebito,
        taxasCredito,
        saldo,
        pendentes: totalPendentes,
        prevReceitas,
        prevDespesas,
      },
      counts: {
        all: transactions.length,
        income: appointments.length,
        expense: countExpenseAll,
        pending: countPending,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
