import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { format, addMonths } from "date-fns";

// GET /api/barbershop/expenses?month=2026-05
export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? format(new Date(), "yyyy-MM");

    const expenses = await prisma.expense.findMany({
      where: { barbershopId, month },
      orderBy: [{ category: "asc" }, { createdAt: "asc" }],
    });

    // KPIs
    const totalDespesas = expenses.reduce((s, e) => s + e.amount, 0);
    const totalPagas = expenses.filter(e => e.status === "PAID").reduce((s, e) => s + e.amount, 0);
    const totalPendentes = expenses.filter(e => e.status === "PENDING").reduce((s, e) => s + e.amount, 0);
    const totalVencidas = expenses.filter(e => e.status === "OVERDUE").reduce((s, e) => s + e.amount, 0);

    // Por categoria
    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    }

    // Mês passado
    const prevDate = addMonths(new Date(month + "-01T12:00:00Z"), -1);
    const prevMonthStr = format(prevDate, "yyyy-MM");
    const prevExpenses = await prisma.expense.findMany({
      where: { barbershopId, month: prevMonthStr },
    });
    const prevTotalDespesas = prevExpenses.reduce((s, e) => s + e.amount, 0);

    return NextResponse.json({
      expenses,
      summary: { totalDespesas, totalPagas, totalPendentes, totalVencidas, byCategory },
      prevSummary: { totalDespesas: prevTotalDespesas },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

// POST /api/barbershop/expenses — criar despesa (+ replicar recorrentes)
export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();
    const {
      name, description, amount, category, type,
      isRecurring, dueDay, paymentMethod, month,
      dueDate, notes, replicateMonths = 0,
    } = body;

    if (!name || !amount || !month) {
      return NextResponse.json({ error: "name, amount e month são obrigatórios" }, { status: 400 });
    }

    const created = [];
    const totalMonths = isRecurring ? Math.max(1, replicateMonths || 1) : 1;

    for (let i = 0; i < totalMonths; i++) {
      const targetDate = addMonths(new Date(month + "-01"), i);
      const targetMonth = format(targetDate, "yyyy-MM");
      let due: Date | null = null;
      if (dueDay) {
        due = new Date(targetDate.getFullYear(), targetDate.getMonth(), dueDay);
      } else if (dueDate && i === 0) {
        due = new Date(dueDate);
      }

      const expense = await prisma.expense.create({
        data: {
          name, description, amount: Number(amount),
          category: category ?? "OUTROS",
          type: type ?? "FIXED",
          isRecurring: !!isRecurring,
          dueDay: dueDay ? Number(dueDay) : null,
          paymentMethod: paymentMethod ?? "PIX",
          status: "PENDING",
          month: targetMonth,
          dueDate: due,
          notes,
          barbershopId,
        },
      });
      created.push(expense);
    }

    return NextResponse.json({ ok: true, created });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

// PATCH /api/barbershop/expenses — marcar como paga / atualizar
export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();
    const { id, status, paidAt, amount, name, notes, paymentMethod } = body;

    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    // Verifica que pertence à barbearia
    const expense = await prisma.expense.findFirst({ where: { id, barbershopId } });
    if (!expense) return NextResponse.json({ error: "Despesa não encontrada" }, { status: 404 });

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(paidAt !== undefined ? { paidAt: paidAt ? new Date(paidAt) : null } : {}),
        ...(status === "PAID" && !paidAt ? { paidAt: new Date() } : {}),
        ...(amount !== undefined ? { amount: Number(amount) } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(paymentMethod !== undefined ? { paymentMethod } : {}),
      },
    });

    return NextResponse.json({ ok: true, expense: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

// DELETE /api/barbershop/expenses?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    const expense = await prisma.expense.findFirst({ where: { id, barbershopId } });
    if (!expense) return NextResponse.json({ error: "Despesa não encontrada" }, { status: 404 });

    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
