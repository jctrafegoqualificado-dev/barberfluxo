import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });

    let barbershopSlug: string | null = null;
    if (payload.barbershopId) {
      const shop = await prisma.barbershop.findUnique({
        where: { id: payload.barbershopId },
        select: { slug: true },
      });
      barbershopSlug = shop?.slug ?? null;
    }

    return NextResponse.json({
      user: { ...user, barbershopId: payload.barbershopId, barbershopSlug },
    });
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}
