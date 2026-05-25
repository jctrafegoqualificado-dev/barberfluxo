import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST — marcar comissão como paga
export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    if (!payload.barbershopId) return NextResponse.json({ error: "Sem barbearia" }, { status: 403 });

    const { barberId, month, amount, type = "STANDARD" } = await req.json();

    // Valida que o barbeiro pertence a esta barbearia antes de registrar pagamento (CVE-9)
    const barberOwned = await prisma.barber.findFirst({
      where: { id: barberId, barbershopId: payload.barbershopId },
      select: { id: true },
    });
    if (!barberOwned) {
      return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
    }

    const payment = await prisma.commissionPayment.upsert({
      where: { barberId_month_type: { barberId, month, type } },
      update: { amount, paidAt: new Date() },
      create: { barberId, month, amount, type, barbershopId: payload.barbershopId },
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

    const { barberId, month, type = "STANDARD" } = await req.json();

    // Valida que o barbeiro pertence a esta barbearia antes de desfazer pagamento (CVE-9)
    const barberOwned = await prisma.barber.findFirst({
      where: { id: barberId, barbershopId: payload.barbershopId },
      select: { id: true },
    });
    if (!barberOwned) {
      return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
    }

    await prisma.commissionPayment.delete({
      where: { barberId_month_type: { barberId, month, type } },
    }).catch(() => {}); // ignora se já não existe

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
