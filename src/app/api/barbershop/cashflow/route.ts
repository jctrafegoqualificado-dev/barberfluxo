import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { buildCashSummary, SESSION_INCLUDE } from "@/lib/cashSummary";
import { round2 } from "@/lib/finance";

function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : "Erro interno";
  const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}

async function userName(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return u?.name ?? null;
}

// GET — caixa aberto (ou o dia de hoje, se não houver) + últimos fechamentos
export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const [session, closings] = await Promise.all([
      prisma.cashFlowSession.findFirst({ where: { barbershopId, status: "OPEN" }, include: SESSION_INCLUDE }),
      prisma.cashFlowSession.findMany({
        where: { barbershopId, status: "CLOSED" },
        orderBy: { closedAt: "desc" },
        take: 5,
        select: { id: true, openedAt: true, closedAt: true, closingBalance: true, expectedBalance: true, totalIn: true, closedByName: true, notes: true },
      }),
    ]);

    const summary = await buildCashSummary(barbershopId, session);
    return NextResponse.json({
      ...summary,
      closings: closings.map((c) => ({
        ...c,
        difference: c.expectedBalance !== null && c.closingBalance !== null ? round2(c.closingBalance - c.expectedBalance) : null,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

// POST — abrir o caixa com o troco
export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();
    const openingBalance = Math.max(0, round2(Number(String(body.openingBalance ?? 0).replace(",", ".")) || 0));

    const existing = await prisma.cashFlowSession.findFirst({ where: { barbershopId, status: "OPEN" } });
    if (existing) return NextResponse.json({ error: "Já existe um caixa aberto." }, { status: 400 });

    // O troco fica só em openingBalance. Antes ele também virava um lançamento de
    // entrada, e a tela somava os dois (o troco aparecia em dobro no saldo).
    const session = await prisma.cashFlowSession.create({
      data: { barbershopId, openingBalance, status: "OPEN", openedByName: await userName(payload.id) },
    });
    return NextResponse.json({ session });
  } catch (e) {
    return fail(e);
  }
}

// PATCH — fechar: guarda o que foi contado, o que deveria ter e quanto entrou
export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { sessionId, closingBalance, notes } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "ID da sessão é obrigatório" }, { status: 400 });

    const session = await prisma.cashFlowSession.findFirst({
      where: { id: sessionId, barbershopId, status: "OPEN" },
      include: SESSION_INCLUDE,
    });
    if (!session) return NextResponse.json({ error: "Caixa não encontrado ou já fechado." }, { status: 404 });

    const counted = round2(Number(String(closingBalance ?? 0).replace(",", ".")) || 0);
    if (counted < 0) return NextResponse.json({ error: "Valor contado inválido." }, { status: 400 });
    const summary = await buildCashSummary(barbershopId, session);

    const closed = await prisma.cashFlowSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closingBalance: counted,
        expectedBalance: summary.drawer.expected,
        totalIn: summary.totalIn,
        closedByName: await userName(payload.id),
        notes: typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 500) : null,
      },
    });
    return NextResponse.json({ session: closed, difference: round2(counted - summary.drawer.expected) });
  } catch (e) {
    return fail(e);
  }
}
