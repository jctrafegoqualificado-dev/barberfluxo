import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { id } = await params;

    // Transação para garantir integridade: limpa dependências antes de excluir
    await prisma.$transaction(async (tx) => {
      // 1. Remove pagamentos vinculados
      await tx.payment.deleteMany({ where: { subscriptionId: id } });

      // 2. Desvincula agendamentos (preserva histórico, mas remove referência)
      await tx.appointment.updateMany({
        where: { subscriptionId: id },
        data: { subscriptionId: null },
      });

      // 3. Exclui a assinatura
      await tx.subscription.delete({
        where: { id, barbershopId: payload.barbershopId! },
      });
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao excluir assinatura";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { id } = await params;
    const { status, planId, nextBillingDate } = await req.json();

    const data: any = {};
    if (status) data.status = status;
    if (planId) data.planId = planId;
    if (nextBillingDate) data.nextBillingDate = new Date(nextBillingDate);

    const subscription = await prisma.subscription.update({
      where: { id, barbershopId: payload.barbershopId! },
      data,
    });

    return NextResponse.json({ subscription });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar assinatura";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

