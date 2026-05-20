import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();
    const { sessionId, type, category, description, amount, paymentMethod } = body;

    if (!sessionId || !type || !description || !amount) {
      return NextResponse.json({ error: "Faltam campos obrigatórios." }, { status: 400 });
    }

    const session = await prisma.cashFlowSession.findFirst({
      where: { id: sessionId, barbershopId, status: "OPEN" },
    });

    if (!session) {
      return NextResponse.json({ error: "Sessão de caixa inválida ou fechada." }, { status: 400 });
    }

    const entry = await prisma.cashFlowEntry.create({
      data: {
        sessionId,
        type,
        category: category || "MANUAL",
        description,
        amount: Number(amount),
        paymentMethod: paymentMethod || "CASH",
      },
    });

    return NextResponse.json({ entry });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
