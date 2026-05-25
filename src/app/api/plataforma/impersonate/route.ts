import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const payload = await requirePlatformAdmin(req);
    const { barbershopId } = await req.json();

    if (!barbershopId) {
      return NextResponse.json({ error: "barbershopId é obrigatório" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({ where: { id: barbershopId } });
    if (!shop || !shop.ownerId) {
      return NextResponse.json({ error: "Barbearia ou Dono não encontrado" }, { status: 404 });
    }

    const owner = await prisma.user.findUnique({
      where: { id: shop.ownerId }
    });

    if (!owner) {
      return NextResponse.json({ error: "Nenhum Dono encontrado para esta barbearia" }, { status: 404 });
    }

    const token = signToken({
      id: owner.id,
      email: owner.email,
      role: owner.role,
      barbershopId: barbershopId,
      impersonatedBy: payload.id // For audit tracking
    });

    return NextResponse.json({ token, user: { name: owner.name, email: owner.email } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
