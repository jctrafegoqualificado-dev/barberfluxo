import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyWaitlistSlotOpened } from "@/lib/waitlist";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { slug, id } = await params;
    const shop = await prisma.barbershop.findUnique({
      where: { slug },
      select: { id: true, active: true, cancelByClientEnabled: true, minCancelHours: true },
    });
    if (!shop || !shop.active) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    if (!shop.cancelByClientEnabled) {
      return NextResponse.json(
        { error: "Cancelamentos pelo cliente não estão habilitados nesta barbearia." },
        { status: 403 }
      );
    }

    const existing = await prisma.appointment.findFirst({
      where: { id, barbershopId: shop.id },
      select: { id: true, status: true, date: true, startTime: true, barberId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }
    if (existing.status === "CANCELLED") {
      return NextResponse.json({ error: "Agendamento já está cancelado" }, { status: 409 });
    }
    if (existing.status === "DONE") {
      return NextResponse.json({ error: "Agendamento já foi concluído" }, { status: 409 });
    }

    if (shop.minCancelHours > 0) {
      const dateStr = existing.date.toISOString().split("T")[0];
      const apptDateTime = new Date(`${dateStr}T${existing.startTime}:00-03:00`);
      const diffHours = (apptDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
      if (diffHours < shop.minCancelHours) {
        return NextResponse.json(
          {
            error: `Cancelamentos devem ser feitos com pelo menos ${shop.minCancelHours}h de antecedência.`,
          },
          { status: 400 }
        );
      }
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { id: true, status: true },
    });

    // Motivo opcional dado pelo cliente na tela "meus horários" (vai para o histórico).
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : "";
    void logAudit({
      barbershopId: shop.id, action: "CANCEL", entity: "Appointment", entityId: id,
      diff: { before: { status: existing.status }, after: { status: "CANCELLED", via: body?.via === "RESCHEDULE" ? "Remarcado pelo cliente" : "Cancelado pelo cliente", ...(reason ? { reason } : {}) } },
    });

    // Lista de espera: a vaga liberada é avisada para quem está na fila do dia.
    void notifyWaitlistSlotOpened({ barbershopId: shop.id, date: existing.date, barberId: existing.barberId, startTime: existing.startTime });

    return NextResponse.json({ appointment });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
