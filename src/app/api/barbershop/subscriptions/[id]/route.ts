import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { cancelMpPreapproval } from "@/lib/mercadopago";

// ─── Helper: cancela preapproval no MP (fire-and-forget) ─────────────────────

async function tryMpCancel(mpPreapprovalId: string | null | undefined, context: string) {
  if (!mpPreapprovalId) return;
  try {
    await cancelMpPreapproval(mpPreapprovalId);
    console.log(`[subscription ${context}] Preapproval ${mpPreapprovalId} cancelado no MP`);
  } catch (err) {
    // Não bloqueia a operação principal — apenas loga
    console.error(`[subscription ${context}] Falha ao cancelar preapproval ${mpPreapprovalId} no MP:`, err);
  }
}

// ─── DELETE /api/barbershop/subscriptions/[id] ────────────────────────────────

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { id } = await params;

    // Busca o mpPreapprovalId antes de excluir
    const sub = await prisma.subscription.findUnique({
      where: { id, barbershopId: payload.barbershopId! },
      select: { mpPreapprovalId: true } as any,
    });

    if (!sub) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }

    // Cancela o débito recorrente no MP antes de remover do banco
    await tryMpCancel((sub as any).mpPreapprovalId, "delete");

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

// ─── PUT /api/barbershop/subscriptions/[id] ───────────────────────────────────

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const { id } = await params;
    const { status, planId, nextBillingDate, billingDay } = await req.json();

    const data: Record<string, unknown> = {};
    if (status)           data.status          = status;
    if (planId)           data.planId          = planId;
    if (nextBillingDate)  data.nextBillingDate  = new Date(nextBillingDate);
    if (billingDay !== undefined) data.billingDay = billingDay ? Number(billingDay) : null;

    // Ao cancelar: cancela o débito automático no MP
    if (status === "CANCELLED") {
      const current = await prisma.subscription.findUnique({
        where: { id, barbershopId: payload.barbershopId! },
        select: { mpPreapprovalId: true } as any,
      });
      await tryMpCancel((current as any)?.mpPreapprovalId, "cancel");
      data.mpPreapprovalId = null;
    }

    const subscription = await prisma.subscription.update({
      where: { id, barbershopId: payload.barbershopId! },
      data: data as any,
    });

    return NextResponse.json({ subscription });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar assinatura";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET /api/barbershop/subscriptions/[id] ───────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const { id } = await params;

    const subscription = await prisma.subscription.findUnique({
      where: { id, barbershopId: payload.barbershopId! },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        plan: {
          include: {
            planServices: {
              include: { service: true }
            }
          }
        },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!subscription) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    return NextResponse.json({ subscription });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao carregar assinatura";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
