import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const { id } = await params;

    // ScheduleBlock não tem barbershopId direto — navega via barber (CVE-4)
    const block = await prisma.scheduleBlock.findUnique({
      where: { id },
      include: { barber: { select: { barbershopId: true } } },
    });
    if (!block || block.barber.barbershopId !== payload.barbershopId!) {
      return NextResponse.json({ error: "Bloqueio não encontrado" }, { status: 404 });
    }

    await prisma.scheduleBlock.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
