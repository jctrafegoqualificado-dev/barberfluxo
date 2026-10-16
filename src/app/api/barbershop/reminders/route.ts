import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: {
        reminderEnabled: true,
        reminderMinutes: true,
        reminderMessage: true,
        reminderAskConfirmation: true,
        notifyBarberOnNewAppointment: true,
      }
    });

    // Números do mês (fuso de SP): lembretes enviados, quantos confirmaram/cancelaram respondendo, faltas.
    const month = new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
    const monthStart = new Date(month + "-01T00:00:00Z");
    const nextMonth = new Date(monthStart); nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const inMonth = { barbershopId, date: { gte: monthStart, lt: nextMonth } };
    const [sent, confirmed, noShows, total, cancelledByReply] = await Promise.all([
      prisma.appointment.count({ where: { ...inMonth, reminderSent: true } }),
      prisma.appointment.count({ where: { ...inMonth, confirmedVia: "WHATSAPP" } }),
      prisma.appointment.count({ where: { ...inMonth, status: "NO_SHOW" } }),
      prisma.appointment.count({ where: { ...inMonth, status: { not: "CANCELLED" } } }),
      prisma.auditLog.count({
        where: { barbershopId, entity: "Appointment", action: "CANCEL", createdAt: { gte: monthStart, lt: nextMonth },
          diff: { path: ["after", "via"], equals: "Resposta NÃO ao lembrete" } },
      }),
    ]);

    return NextResponse.json({ ...barbershop, stats: { sent, confirmed, cancelledByReply, noShows, total } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();

    const updated = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        reminderEnabled: body.reminderEnabled ?? false,
        reminderMinutes: Number(body.reminderMinutes || 60),
        reminderMessage: body.reminderMessage || null,
        reminderAskConfirmation:
          typeof body.reminderAskConfirmation === "boolean" ? body.reminderAskConfirmation : undefined,
        // Só atualiza se vier no body (não sobrescreve com default em saves parciais)
        notifyBarberOnNewAppointment:
          typeof body.notifyBarberOnNewAppointment === "boolean"
            ? body.notifyBarberOnNewAppointment
            : undefined,
      }
    });

    return NextResponse.json({
      reminderEnabled: updated.reminderEnabled,
      reminderMinutes: updated.reminderMinutes,
      reminderMessage: updated.reminderMessage,
      reminderAskConfirmation: updated.reminderAskConfirmation,
      notifyBarberOnNewAppointment: updated.notifyBarberOnNewAppointment,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
