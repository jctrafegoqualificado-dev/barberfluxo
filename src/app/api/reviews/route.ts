import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/evolution/client";

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

    // ── Saldo de pontos atualizado + config de fidelidade ──────────────────
    const [balanceAgg, shopConfig] = await Promise.all([
      prisma.loyaltyPoint.aggregate({
        where: { clientId: appointment.clientId, barbershopId: appointment.barbershopId },
        _sum: { points: true },
      }),
      prisma.barbershop.findUnique({
        where: { id: appointment.barbershopId },
        select: { loyaltyThreshold: true, loyaltyDiscountPercent: true },
      }),
    ]);
    const loyaltyBalance = balanceAgg._sum.points ?? 0;

    // ── NPS follow-up via WhatsApp (non-critical) ──────────────────────────
    try {
      const [client, shop] = await Promise.all([
        prisma.user.findUnique({
          where: { id: appointment.clientId },
          select: { name: true, phone: true },
        }),
        prisma.barbershop.findUnique({
          where: { id: appointment.barbershopId },
          select: {
            name: true,
            owner: { select: { phone: true } },
            whatsappInstance: {
              select: { evolutionInstanceName: true, evolutionToken: true, status: true },
            },
          },
        }),
      ]);

      if (shop?.whatsappInstance?.status === "CONNECTED") {
        const { evolutionInstanceName, evolutionToken } = shop.whatsappInstance;
        const firstName = client?.name?.split(" ")[0] ?? "Cliente";

        let clientMsg: string;
        if (ratingInt >= 9) {
          clientMsg = `Obrigado, ${firstName}! 🌟 Ficamos muito felizes com sua avaliação!\n\nSe quiser indicar a *${shop.name}* para um amigo, será uma honra receber mais clientes como você! 🙏✂️`;
        } else if (ratingInt >= 7) {
          clientMsg = `Obrigado pela avaliação, ${firstName}! 😊\n\nFoi um prazer atender você. Até a próxima! ✂️`;
        } else {
          clientMsg = `Obrigado pelo feedback, ${firstName}. 🙏\n\nSentimos muito que a experiência não foi a ideal. Vamos trabalhar para melhorar e esperamos te surpreender na próxima visita!`;
        }

        if (client?.phone) {
          await sendMessage(evolutionInstanceName, client.phone, clientMsg, 1200, evolutionToken);
        }

        // Alerta ao dono para detratores (≤6)
        if (ratingInt <= 6 && shop.owner?.phone) {
          const ownerMsg = `⚠️ *Alerta NPS — ${shop.name}*\n\nO cliente *${client?.name ?? "desconhecido"}* deixou uma nota *${ratingInt}/10*.\n\nConsidere entrar em contato para entender o que aconteceu e reconquistar esse cliente.`;
          await sendMessage(evolutionInstanceName, shop.owner.phone, ownerMsg, 1200, evolutionToken);
        }
      }
    } catch {
      // WhatsApp falhou — review já salva, não impacta o cliente
    }

    return NextResponse.json({
      success: true,
      ...result,
      loyaltyBalance,
      loyaltyThreshold: shopConfig?.loyaltyThreshold ?? 50,
      loyaltyDiscountPercent: shopConfig?.loyaltyDiscountPercent ?? 10,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
