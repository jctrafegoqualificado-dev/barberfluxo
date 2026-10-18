import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { round2 } from "@/lib/finance";
import { buildCashSummary, SESSION_INCLUDE } from "@/lib/cashSummary";

const CATEGORIES = ["SANGRIA", "SUPRIMENTO", "VENDA", "SERVICO", "OUTROS", "MANUAL"];
const METHODS = ["CASH", "PIX", "CREDIT", "DEBIT", "CREDIT_CARD", "DEBIT_CARD", "BOLETO"];

function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : "Erro interno";
  return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 });
}

// POST — lançamento manual no caixa aberto: retirar dinheiro (SANGRIA), colocar
// dinheiro (SUPRIMENTO) ou outra entrada/saída.
export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { sessionId, type, category, description, amount, paymentMethod } = await req.json();

    const value = round2(Number(String(amount ?? "").replace(",", ".")));
    if (!sessionId || !description?.trim() || !(value > 0)) {
      return NextResponse.json({ error: "Informe a descrição e um valor maior que zero." }, { status: 400 });
    }
    if (type !== "INCOME" && type !== "EXPENSE") return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });

    const session = await prisma.cashFlowSession.findFirst({ where: { id: sessionId, barbershopId, status: "OPEN" }, include: SESSION_INCLUDE });
    if (!session) return NextResponse.json({ error: "Sessão de caixa inválida ou fechada." }, { status: 400 });

    // Retirar e colocar dinheiro mexem na gaveta: sempre em dinheiro.
    const cat = CATEGORIES.includes(category) ? category : "MANUAL";
    const method = cat === "SANGRIA" || cat === "SUPRIMENTO" ? "CASH" : METHODS.includes(paymentMethod) ? paymentMethod : "CASH";

    // Não dá para tirar da gaveta mais do que tem nela
    if (type === "EXPENSE" && method === "CASH") {
      const { drawer } = await buildCashSummary(barbershopId, session);
      if (value > Math.max(0, drawer.expected) + 0.001) {
        const has = Math.max(0, drawer.expected).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        return NextResponse.json({ error: `Na gaveta só tem ${has}. Não dá para retirar mais do que isso.` }, { status: 400 });
      }
    }

    const entry = await prisma.cashFlowEntry.create({
      data: { sessionId, type, category: cat, description: description.trim().slice(0, 120), amount: value, paymentMethod: method },
    });
    return NextResponse.json({ entry });
  } catch (e) {
    return fail(e);
  }
}

// DELETE ?id= — desfaz um lançamento manual do caixa aberto
export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    const entry = await prisma.cashFlowEntry.findFirst({
      where: { id, session: { barbershopId: payload.barbershopId!, status: "OPEN" } },
      select: { id: true },
    });
    if (!entry) return NextResponse.json({ error: "Lançamento não encontrado (o caixa já foi fechado?)" }, { status: 404 });
    await prisma.cashFlowEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
