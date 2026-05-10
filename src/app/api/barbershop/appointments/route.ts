import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const barberId = searchParams.get("barberId");

    const where: Record<string, unknown> = { barbershopId };
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      where.date = { gte: d, lte: end };
    }
    if (barberId) where.barberId = barberId;
    if (payload.role === "BARBER") {
      const barber = await prisma.barber.findUnique({ where: { userId: payload.id } });
      if (barber) where.barberId = barber.id;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        barber: { include: { user: { select: { name: true } } } },
        service: true,
        subscription: { include: { plan: { select: { name: true } } } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    return NextResponse.json({ appointments });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    requireAuth(req, ["OWNER", "BARBER"]);
    const { id, status, paymentMethod } = await req.json();

    const updateData: Record<string, unknown> = { status };
    if (paymentMethod) updateData.paymentMethod = paymentMethod;

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: { subscription: true },
    });

    // Se finalizou E tem assinatura vinculada → incrementa uso da assinatura
    if (status === "DONE" && appointment.subscriptionId) {
      const sub = await prisma.subscription.findUnique({
        where: { id: appointment.subscriptionId },
        include: { plan: true },
      });

      if (sub) {
        const newUses = sub.usesThisCycle + 1;
        // Se ultrapassou o limite do plano, não deixa usar mais (opcional: bloquear no agendamento)
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { usesThisCycle: newUses },
        });
      }
    }

    return NextResponse.json({ appointment });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
