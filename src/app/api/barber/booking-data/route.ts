import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["BARBER", "OWNER"]);
    const barber = await prisma.barber.findUnique({
      where: { userId: payload.id },
      include: {
        barbershop: {
          select: {
            slug: true,
            services: { where: { active: true }, orderBy: { name: "asc" } },
          },
        },
        user: { select: { name: true } },
      },
    });
    if (!barber) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });

    return NextResponse.json({
      barberId: barber.id,
      barberName: barber.user.name,
      slug: barber.barbershop.slug,
      services: barber.barbershop.services,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
