import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const shop = await prisma.barbershop.findUnique({ where: { slug }, select: { id: true, active: true } });
    if (!shop || !shop.active) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }
    const services = await prisma.service.findMany({
      where: { barbershopId: shop.id, active: true },
      select: { id: true, name: true, description: true, price: true, duration: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ services });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
