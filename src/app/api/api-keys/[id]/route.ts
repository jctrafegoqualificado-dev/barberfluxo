import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const apiKey = await prisma.apiKey.findUnique({ where: { id } });
    if (!apiKey) {
      return NextResponse.json({ error: "API Key não encontrada" }, { status: 404 });
    }
    if (apiKey.barbershopId !== barbershopId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: { id: true, revokedAt: true },
    });

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
