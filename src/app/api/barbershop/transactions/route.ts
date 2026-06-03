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

    // ── 1-2b. Todas as queries em paralelo
    const [shop, appointments, expenses, subscriptionPayments] = await Promise.all([
      prisma.barbershop.findUnique({
        where: { id: barbershopId },
        select: { debitFee: true, creditFee: true },
      }),
      prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", date: { gte: monthStart, lte: monthEnd } },
        select: {
          id: true,
          price: true,
          paymentMethod: true,
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
      prisma.payment.findMany({
        where: {
          subscription: { barbershopId },
          status: "PAID",
          paidAt: { gte: monthStart, lte: monthEnd },
        },
        select: {
          id: true,
          amount: true,
          method: true,
          paidAt: true,
          createdAt: true,
          subscription: {
            select: {
              client: { select: { name: true } },
              plan: { select: { name: true } },
            },
          },
        },
        orderBy: { paidAt: "desc" },
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

    for (const appt of appointments) {
      const method = appt.paymentMethod ?? "CASH";
      const feeRate = method === "DEBIT" || method === "DEBIT_CARD" ? debitFee / 100
        : method === "CREDIT" || method === "CREDIT_CARD" ? creditFee / 100 : 0;
      const fee = appt.price * feeRate;
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

    for (const exp of expenses) {
      transactions.push({
        id: exp.id,
        type: "EXPENSE",
        description: exp.name,
        amount: exp.amount,
        fee: 0,
        net: exp.amount,
        paymentMethod: exp.paymentMethod ?? "PIX",
        paymentMethodLabel: PAYMENT_LABELS[exp.paymentMethod ?? "PIX"] ?? exp.paymentMethod ?? "PIX",
        status: exp.status, // PAID | PENDING | OVERDUE
        date: exp.dueDate?.toISOString() ?? exp.createdAt.toISOString(),
        category: exp.category,
        clientOrBarber: undefined,
      });
    }

    // Subscription payments (baixa de mensalidade)
    for (const pay of subscriptionPayments) {
      const method = pay.method ?? "CASH";
      const planName = pay.subscription?.plan?.name ?? "Assinatura";
      const clientName = pay.subscription?.client?.name ?? "Assinante";
      transactions.push({
        id: `pay_${pay.id}`,
        type: "INCOME",
        description: `Mensalidade — ${planName}`,
        amount: pay.amount,
        fee: 0,
        net: pay.amount,
        paymentMethod: method,
        paymentMethodLabel: PAYMENT_LABELS[method] ?? method,
        status: "PAID",
        date: (pay.paidAt ?? pay.createdAt).toISOString(),
        category: "ASSINATURA",
        clientOrBarber: clientName,
      });
    }

    // Sort all by date desc
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // ── 4. KPIs
    const totalMensalidades = subscriptionPayments.reduce((s, p) => s + p.amount, 0);
    const totalReceitas = appointments.reduce((s, a) => s + a.price, 0) + totalMensalidades;
    let taxasDebito = 0;
    let taxasCredito = 0;
    const totalTaxas = appointments.reduce((a, ap) => {
      const method = ap.paymentMethod ?? "CASH";
      const feeRate = method === "DEBIT" || method === "DEBIT_CARD" ? debitFee / 100
        : method === "CREDIT" || method === "CREDIT_CARD" ? creditFee / 100 : 0;
      const taxa = ap.price * feeRate;
      if (method === "DEBIT" || method === "DEBIT_CARD") taxasDebito += taxa;
      if (method === "CREDIT" || method === "CREDIT_CARD") taxasCredito += taxa;
      return a + taxa;
    }, 0);
    const totalDespesas = expenses.reduce((s, e) => s + e.amount, 0);
    const despesasFixas = expenses.filter(e => e.type === "FIXED").reduce((s, e) => s + e.amount, 0);
    const despesasVariaveis = totalDespesas - despesasFixas;
    // Saldo: (atendimentos avulsos + mensalidades) - taxas de máquina - despesas
    const saldo = totalReceitas - totalTaxas - totalDespesas;
    const totalPendentes = expenses.filter(e => e.status === "PENDING").reduce((s, e) => s + e.amount, 0);

    // ── 5. Filter by tab
    let filtered = transactions;
    if (tab === "income") filtered = transactions.filter(t => t.type === "INCOME");
    else if (tab === "expense") filtered = transactions.filter(t => t.type === "EXPENSE");
    else if (tab === "pending") filtered = transactions.filter(t => t.status === "PENDING" || t.status === "OVERDUE");

    // ── 6. Previous month for comparison
    const prevMonthStart = startOfMonth(addMonths(monthStart, -1));
    const prevMonthEnd = endOfMonth(prevMonthStart);
    const prevMonthStr = format(prevMonthStart, "yyyy-MM");
    const [prevAppts, prevExpenses] = await Promise.all([
      prisma.appointment.aggregate({
        where: { barbershopId, status: "DONE", date: { gte: prevMonthStart, lte: prevMonthEnd } },
        _sum: { price: true },
      }),
      prisma.expense.aggregate({
        where: { barbershopId, month: prevMonthStr },
        _sum: { amount: true },
      }),
    ]);
    const prevReceitas = prevAppts._sum.price ?? 0;
    const prevDespesas = prevExpenses._sum.amount ?? 0;

    // ── 7. Caixa Avulso Breakdown
    const avulsoByMethod: Record<string, { count: number; bruto: number; taxa: number; liquido: number }> = {};
    let avulsoBrutoTotal = 0;
    let avulsoLiquidoTotal = 0;

    for (const ap of appointments) {
      if (ap.subscriptionId) continue; // Pula os que são de assinatura
      
      const method = ap.paymentMethod ?? "CASH";
      const feeRate = method === "DEBIT" || method === "DEBIT_CARD" ? debitFee / 100
        : method === "CREDIT" || method === "CREDIT_CARD" ? creditFee / 100 : 0;
      const taxa = ap.price * feeRate;
      
      if (!avulsoByMethod[method]) avulsoByMethod[method] = { count: 0, bruto: 0, taxa: 0, liquido: 0 };
      avulsoByMethod[method].count += 1;
      avulsoByMethod[method].bruto += ap.price;
      avulsoByMethod[method].taxa += taxa;
      avulsoByMethod[method].liquido += ap.price - taxa;
      avulsoBrutoTotal += ap.price;
      avulsoLiquidoTotal += ap.price - taxa;
    }

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
      mensalidades: totalMensalidades,
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
        income: transactions.filter(t => t.type === "INCOME").length,
        expense: transactions.filter(t => t.type === "EXPENSE").length,
        pending: transactions.filter(t => t.status === "PENDING" || t.status === "OVERDUE").length,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
