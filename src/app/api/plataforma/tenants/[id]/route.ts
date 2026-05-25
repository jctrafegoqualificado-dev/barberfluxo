import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin(req);
    const { id } = await params;
    const { active, saasPlan, saasStatus } = await req.json();

    const updateData: Record<string, any> = {};

    // Alterar plano → ativa automaticamente
    if (saasPlan !== undefined) {
      updateData.saasPlan = saasPlan;
      updateData.saasStatus = "ACTIVE"; // plano trocado pelo admin = assinante ativo
    }

    // Alterar status explícito (ex: PAUSED, CANCELLED)
    if (saasStatus !== undefined) {
      updateData.saasStatus = saasStatus;
    }

    // Bloquear/desbloquear acesso
    if (active !== undefined) {
      updateData.active = active;
      // Ao bloquear → marca como CANCELLED; ao reativar → marca como ACTIVE
      if (!updateData.saasStatus) {
        updateData.saasStatus = active ? "ACTIVE" : "CANCELLED";
      }
    }

    const shop = await prisma.barbershop.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ shop });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
