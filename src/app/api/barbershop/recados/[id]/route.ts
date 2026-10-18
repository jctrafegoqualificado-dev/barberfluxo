import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// DELETE — o dono apaga um recado (some também para a equipe).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { id } = await params;

    const result = await prisma.teamNotice.deleteMany({ where: { id, barbershopId: payload.barbershopId! } });
    if (result.count === 0) return NextResponse.json({ error: "Recado não encontrado" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
