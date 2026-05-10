import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST — marcar comissão como paga
export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    if (!payload.barbershopId) return NextResponse.json({ error: "Sem barbearia" }, { status: 403 });

    const { barberId, month, amount } = await req.json();

    const payment = await prisma.commissionPayment.upsert({
      where: { barberId_month: { barberId, month } },
      update: { amount, paidAt: new Date() },
      create: { barberId, month, amount, barbershopId: payload.barbershopId },
    });

    return NextResponse.json({ payment });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE — desfazer pagamento
export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    if (!payload.barbershopId) return NextResponse.json({ error: "Sem barbearia" }, { status: 403 });

    const { barberId, month } = await req.json();

    await prisma.commissionPayment.delete({
      where: { barberId_month: { barberId, month } },
    }).catch(() => {}); // ignora se já não existe

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
