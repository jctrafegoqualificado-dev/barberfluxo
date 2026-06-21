import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";

const VALID_PLANS = ["BASIC", "PRO", "ELITE", "PREMIUM"];
const VALID_STATUSES = ["TRIAL", "ACTIVE", "OVERDUE", "CANCELLED", "PAUSED"];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requirePlatformAdmin(req);
    const { id } = await params;
    const { active, saasPlan, saasStatus } = await req.json();

    // Validação de input — saasStatus é string livre no schema; sem whitelist,
    // valores arbitrários corrompem todas as métricas que filtram por status.
    if (saasPlan !== undefined && !VALID_PLANS.includes(saasPlan)) {
      return NextResponse.json({ error: `Plano inválido. Use: ${VALID_PLANS.join(", ")}` }, { status: 400 });
    }
    if (saasStatus !== undefined && !VALID_STATUSES.includes(saasStatus)) {
      return NextResponse.json({ error: `Status inválido. Use: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }
    if (active !== undefined && typeof active !== "boolean") {
      return NextResponse.json({ error: "active deve ser booleano" }, { status: 400 });
    }

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

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 400 });
    }

    // Garante 404 (em vez de 500 do P2025) quando a barbearia não existe
    const existing = await prisma.barbershop.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const shop = await prisma.barbershop.update({
      where: { id },
      data: updateData,
    });

    void logAudit({
      barbershopId: id,
      userId: payload.id,
      userEmail: payload.email,
      userRole: payload.role,
      action: saasPlan !== undefined ? "PLAN_CHANGE" : "STATUS_CHANGE",
      entity: "Barbershop",
      entityId: id,
      diff: { after: updateData },
      ip: getClientIp(req),
    });

    return NextResponse.json({ shop });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
