import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEntitlements } from "@/lib/entitlements";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const shop = await prisma.barbershop.findUnique({
      where: { slug, active: true },
      include: {
        services: { where: { active: true }, orderBy: { name: "asc" } },
        barbers: { where: { active: true }, include: { user: { select: { name: true } } } },
        openingHours: { orderBy: { dayOfWeek: "asc" } },
      },
    });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    // Paywall: barbearia sem plano ativo não recebe agendamento público.
    if (!getEntitlements(shop).hasAccess) {
      return NextResponse.json(
        { error: "Agendamento indisponível no momento.", unavailable: true },
        { status: 403 }
      );
    }

    return NextResponse.json({ shop });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
