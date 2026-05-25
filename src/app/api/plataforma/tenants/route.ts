import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requirePlatformAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);

    const shops = await prisma.barbershop.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { appointments: true, barbers: true }
        }
      }
    });

    return NextResponse.json({ shops });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
