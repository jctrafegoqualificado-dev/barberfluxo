import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";
import { cancelAutoDebit, pauseAutoDebit } from "@/lib/subscriptionGateway";

const STATUSES = ["ACTIVE", "PAUSED", "OVERDUE", "CANCELLED"];

// ─── DELETE /api/barbershop/subscriptions/[id] ────────────────────────────────

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;

    const sub = await prisma.subscription.findUnique({
      where: { id, barbershopId },
      select: { mpPreapprovalId: true },
    });
    if (!sub) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    // Cancela o débito recorrente no MP antes de remover do banco
    await cancelAutoDebit(barbershopId, sub.mpPreapprovalId, "delete");

    // Transação para garantir integridade: limpa dependências antes de excluir
    await prisma.$transaction(async (tx) => {
      // 1. Remove pagamentos vinculados
      await tx.payment.deleteMany({ where: { subscriptionId: id } });
      // 2. Desvincula agendamentos (preserva histórico, mas remove referência)
      await tx.appointment.updateMany({ where: { subscriptionId: id }, data: { subscriptionId: null } });
      // 3. Exclui a assinatura
      await tx.subscription.delete({ where: { id, barbershopId } });
    });

    void logAudit({
      barbershopId, userId: payload.id, userEmail: payload.email, userRole: payload.role,
      action: "DELETE", entity: "Subscription", entityId: id, ip: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao excluir assinatura";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── PUT /api/barbershop/subscriptions/[id] ───────────────────────────────────

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;
    const { status, planId, nextBillingDate, billingDay, paymentMethod } = await req.json();

    const current = await prisma.subscription.findUnique({
      where: { id, barbershopId },
      select: { status: true, mpPreapprovalId: true, authorizationStatus: true },
    });
    if (!current) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (status) {
      if (!STATUSES.includes(status)) return NextResponse.json({ error: "Situação inválida" }, { status: 400 });
      data.status = status;
    }
    if (planId) {
      const plan = await prisma.plan.findFirst({ where: { id: planId, barbershopId }, select: { id: true } });
      if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
      data.planId = planId;
    }
    if (nextBillingDate) {
      // "YYYY-MM-DD" = o dia do vencimento; grava ao meio-dia UTC (mesmo dia em qualquer fuso)
      const d = /^\d{4}-\d{2}-\d{2}$/.test(nextBillingDate) ? new Date(`${nextBillingDate}T12:00:00Z`) : new Date(nextBillingDate);
      if (isNaN(d.getTime())) return NextResponse.json({ error: "Data inválida" }, { status: 400 });
      data.nextBillingDate = d;
    }
    if (billingDay !== undefined) {
      const n = billingDay ? Number(billingDay) : null;
      if (n != null && !(n >= 1 && n <= 31)) return NextResponse.json({ error: "Dia de cobrança vai de 1 a 31" }, { status: 400 });
      data.billingDay = n;
    }
    if (paymentMethod !== undefined) {
      if (!["PIX", "CASH", "CARD"].includes(paymentMethod)) return NextResponse.json({ error: "Forma de pagamento inválida" }, { status: 400 });
      data.paymentMethod = paymentMethod;
    }

    // Cancelar: o débito automático no MP para de cobrar (com o token da barbearia)
    if (status === "CANCELLED" && current.mpPreapprovalId) {
      await cancelAutoDebit(barbershopId, current.mpPreapprovalId, "cancel");
      data.mpPreapprovalId = null;
      data.authorizationLink = null;
      data.authorizationStatus = "CANCELLED";
    }
    // Pausar: o MP também para de cobrar até o dono retomar o débito
    if (status === "PAUSED" && current.authorizationStatus === "AUTHORIZED") {
      if (await pauseAutoDebit(barbershopId, current.mpPreapprovalId, "pause")) data.authorizationStatus = "PAUSED";
    }

    const subscription = await prisma.subscription.update({ where: { id, barbershopId }, data });

    void logAudit({
      barbershopId, userId: payload.id, userEmail: payload.email, userRole: payload.role,
      action: status === "CANCELLED" ? "CANCEL" : status && status !== current.status ? "STATUS_CHANGE" : "UPDATE",
      entity: "Subscription", entityId: id,
      diff: { before: { status: current.status }, after: data },
      ip: getClientIp(req),
    });

    return NextResponse.json({ subscription });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar assinatura";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
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
        plan: { include: { planServices: { include: { service: true } } } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!subscription) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    const res = NextResponse.json({ subscription });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao carregar assinatura";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
