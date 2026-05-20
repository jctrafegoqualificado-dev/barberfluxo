import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { format, startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || format(new Date(), "yyyy-MM");

    const startDate = startOfMonth(new Date(month + "-01T12:00:00Z"));
    const endDate = endOfMonth(new Date(month + "-01T12:00:00Z"));

    // Buscar despesas do mês
    const expenses = await prisma.expense.findMany({
      where: { barbershopId, month },
      orderBy: { createdAt: "asc" },
    });

    // Buscar receitas avulsas do mês
    const appointments = await prisma.appointment.findMany({
      where: {
        barbershopId,
        status: "DONE",
        subscriptionId: null, // Apenas avulsos
        date: { gte: startDate, lte: endDate },
      },
      include: { service: true, barber: { include: { user: true } } },
      orderBy: { date: "asc" },
    });

    // Buscar assinaturas ativas para MRR
    const subscriptions = await prisma.subscription.findMany({
      where: { barbershopId, status: "ACTIVE" },
      include: { plan: true },
    });
    
    // Calcular receitas de assinaturas proporcionalmente
    const totalAssinaturas = subscriptions.reduce((s, sub) => s + sub.plan.price, 0);

    // Gerar CSV
    let csv = "Data,Tipo,Categoria,Descricao,Valor(R$),Forma de Pagamento,Status\n";

    // 1. Receitas Avulsas
    for (const appt of appointments) {
      const dataStr = format(appt.date, "dd/MM/yyyy");
      const desc = `${appt.service?.name || "Servico"} - ${appt.barber?.user?.name || ""}`;
      csv += `${dataStr},ENTRADA,SERVICOS,${desc},${appt.price.toFixed(2)},${appt.paymentMethod || "CASH"},PAGO\n`;
    }

    // 2. Receitas Recorrentes (Assinaturas)
    if (totalAssinaturas > 0) {
      csv += `01/${month.split("-")[1]}/${month.split("-")[0]},ENTRADA,ASSINATURAS,Receita Recorrente (MRR),${totalAssinaturas.toFixed(2)},-,PAGO\n`;
    }

    // 3. Despesas
    for (const exp of expenses) {
      const dataStr = exp.paidAt ? format(exp.paidAt, "dd/MM/yyyy") : (exp.dueDay ? `${String(exp.dueDay).padStart(2, "0")}/${month.split("-")[1]}/${month.split("-")[0]}` : "-");
      csv += `${dataStr},SAIDA,${exp.category},${exp.name},${exp.amount.toFixed(2)},${exp.paymentMethod || "-"},${exp.status}\n`;
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fechamento_${month}.csv"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
