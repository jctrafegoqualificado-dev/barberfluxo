import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const appointmentId = searchParams.get("appointmentId");

    if (!appointmentId) {
      return NextResponse.json({ error: "ID do agendamento ausente" }, { status: 400 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: { select: { name: true } },
        barber: { include: { user: { select: { name: true } } } },
        barbershop: { select: { name: true, logoUrl: true, primaryColor: true } },
        service: { select: { name: true } },
        review: true,
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ appointment });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appointmentId, rating, comment } = body;

    if (!appointmentId || rating === undefined) {
      return NextResponse.json({ error: "Dados obrigatórios ausentes" }, { status: 400 });
    }

    const ratingInt = parseInt(rating);
    if (isNaN(ratingInt) || ratingInt < 0 || ratingInt > 10) {
      return NextResponse.json({ error: "A nota deve ser entre 0 e 10" }, { status: 400 });
    }

    // Busca o agendamento
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { review: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    if (appointment.review) {
      return NextResponse.json({ error: "Este agendamento já foi avaliado" }, { status: 400 });
    }

    // Cria a avaliação + Adiciona pontos de fidelidade na mesma transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cria a Review
      const review = await tx.review.create({
        data: {
          rating: ratingInt,
          comment: comment || null,
          appointmentId: appointment.id,
          clientId: appointment.clientId,
          barbershopId: appointment.barbershopId,
          barberId: appointment.barberId,
        },
      });

      // 2. Adiciona +10 pontos de fidelidade
      const points = await tx.loyaltyPoint.create({
        data: {
          points: 10,
          action: "EARNED",
          description: `Avaliação do agendamento #${appointment.id.slice(-6).toUpperCase()}`,
          clientId: appointment.clientId,
          barbershopId: appointment.barbershopId,
        },
      });

      return { review, points };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
