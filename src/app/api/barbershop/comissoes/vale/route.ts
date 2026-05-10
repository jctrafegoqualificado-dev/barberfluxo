import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { barberId, month, amount, description } = await req.json();

    const vale = await prisma.commissionVale.create({
      data: {
        barberId,
        barbershopId: payload.barbershopId!,
        month,
        amount: Number(amount),
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
    requireAuth(req, ["OWNER"]);
    const { id } = await req.json();
    await prisma.commissionVale.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
