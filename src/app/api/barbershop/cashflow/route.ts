import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const session = await prisma.cashFlowSession.findFirst({
      where: { barbershopId, status: "OPEN" },
      include: {
        entries: { orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json({ session });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();
    const openingBalance = Number(body.openingBalance) || 0;

    const existing = await prisma.cashFlowSession.findFirst({
      where: { barbershopId, status: "OPEN" },
    });

    if (existing) {
      return NextResponse.json({ error: "Já existe um caixa aberto." }, { status: 400 });
    }

    const session = await prisma.cashFlowSession.create({
      data: { barbershopId, openingBalance, status: "OPEN" },
    });

    if (openingBalance > 0) {
      await prisma.cashFlowEntry.create({
        data: {
          sessionId: session.id,
          type: "INCOME",
          category: "SUPRIMENTO",
          description: "Saldo inicial (Troco)",
          amount: openingBalance,
          paymentMethod: "CASH",
        },
      });
    }

    return NextResponse.json({ session });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();
    const { sessionId, closingBalance, notes } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "ID da sessão é obrigatório" }, { status: 400 });
    }

    const session = await prisma.cashFlowSession.update({
      where: { id: sessionId, barbershopId },
      data: {
        status: "CLOSED",
        closingBalance: Number(closingBalance) || 0,
        closedAt: new Date(),
        notes,
      },
    });

    return NextResponse.json({ session });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
