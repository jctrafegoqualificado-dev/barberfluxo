import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const shop = await prisma.barbershop.findUnique({ where: { slug }, select: { id: true, active: true } });
    if (!shop || !shop.active) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }
    const barbers = await prisma.barber.findMany({
      where: { barbershopId: shop.id, active: true },
      select: {
        id: true,
        nickname: true,
        photoUrl: true,
        dayOff: true,
        user: { select: { name: true } },
      },
      orderBy: { user: { name: "asc" } },
    });
    const formatted = barbers.map((b) => ({
      id: b.id,
      name: b.user.name,
      nickname: b.nickname,
      photoUrl: b.photoUrl,
      dayOff: b.dayOff,
    }));
    return NextResponse.json({ barbers: formatted });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
