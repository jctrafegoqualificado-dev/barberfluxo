import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(req, ["PLATFORM_ADMIN"]);
    const { id } = await params;
    const { active, saasPlan } = await req.json();

    const shop = await prisma.barbershop.update({
      where: { id },
      data: {
        active: active !== undefined ? active : undefined,
        saasPlan: saasPlan || undefined,
      }
    });

    return NextResponse.json({ shop });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
