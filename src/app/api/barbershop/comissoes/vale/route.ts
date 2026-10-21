import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { barberId, month, amount, description } = await req.json();

    // O profissional precisa ser desta barbearia
    const barber = await prisma.barber.findFirst({ where: { id: barberId, barbershopId: payload.barbershopId! }, select: { id: true } });
    if (!barber) return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
    const value = Number(amount);
    if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Vales são lançados no mês. Saia do período personalizado para lançar." }, { status: 400 });
    }
    if (!(value > 0)) {
      return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });
    }

    const vale = await prisma.commissionVale.create({
      data: {
        barberId,
        barbershopId: payload.barbershopId!,
        month,
        amount: Math.round(value * 100) / 100,
        description: description || null,
      },
    });

    return NextResponse.json({ vale }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { id } = await req.json();
    // Só apaga vale desta barbearia (antes qualquer dono apagava pelo id)
    const { count } = await prisma.commissionVale.deleteMany({ where: { id, barbershopId: payload.barbershopId! } });
    if (count === 0) return NextResponse.json({ error: "Vale não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
