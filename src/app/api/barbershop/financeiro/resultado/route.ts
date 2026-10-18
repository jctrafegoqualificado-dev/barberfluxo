import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { addMonth, buildMonthResult, currentMonthSP, monthStartSP } from "@/lib/monthResult";
import { buildCashSummary, SESSION_INCLUDE } from "@/lib/cashSummary";

// GET ?month=YYYY-MM — Resultado do mês (docs/design/Financeiro-desktop.dc.html)
export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const param = req.nextUrl.searchParams.get("month");
    const current = currentMonthSP();
    const month = param && /^\d{4}-\d{2}$/.test(param) && param <= current ? param : current;
    const isCurrent = month === current;

    // Comparativo justo: no mês corrente, o anterior até o mesmo ponto do mês
    const prevMonth = addMonth(month, -1);
    const elapsed = Date.now() - monthStartSP(month).getTime();
    const prevUntil = isCurrent ? new Date(monthStartSP(prevMonth).getTime() + elapsed) : undefined;

    const [result, prev, session] = await Promise.all([
      buildMonthResult(barbershopId, month),
      buildMonthResult(barbershopId, prevMonth, prevUntil),
      isCurrent ? prisma.cashFlowSession.findFirst({ where: { barbershopId, status: "OPEN" }, include: SESSION_INCLUDE }) : null,
    ]);
    const cash = session ? await buildCashSummary(barbershopId, session) : null;

    return NextResponse.json({
      ...result,
      isCurrent,
      prev: { month: prevMonth, sobrou: prev.sobrou, entrou: prev.entrou.total, despesas: prev.despesas },
      cash: cash ? { open: true, totalIn: cash.totalIn, drawer: cash.drawer.expected } : { open: false, totalIn: 0, drawer: 0 },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
