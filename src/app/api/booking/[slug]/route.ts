import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEntitlements } from "@/lib/entitlements";

// Dados públicos da barbearia para o link de agendamento. Só o que a página mostra —
// antes devolvia o registro inteiro (CNPJ, configurações da IA, IDs de cobrança…).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const shop = await prisma.barbershop.findUnique({
      where: { slug, active: true },
      select: {
        id: true, name: true, slug: true, description: true, logoUrl: true,
        primaryColor: true, secondaryColor: true,
        phone: true, address: true, streetNumber: true, neighborhood: true, city: true, state: true,
        cancelByClientEnabled: true, minCancelHours: true, reminderEnabled: true, reminderMinutes: true,
        saasPlan: true, saasStatus: true, trialEndsAt: true, saasExpiresAt: true,
        services: {
          where: { active: true, onlineBooking: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, description: true, price: true, duration: true },
        },
        barbers: {
          where: { active: true, archivedAt: null },
          select: { id: true, nickname: true, bio: true, photoUrl: true, user: { select: { name: true } } },
        },
        openingHours: { orderBy: { dayOfWeek: "asc" }, select: { dayOfWeek: true, openTime: true, closeTime: true, isOpen: true } },
      },
    });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    // Paywall: barbearia sem plano ativo não recebe agendamento público.
    if (!getEntitlements(shop).hasAccess) {
      return NextResponse.json(
        { error: "Agendamento indisponível no momento.", unavailable: true },
        { status: 403 }
      );
    }

    // Nota média das avaliações (0–10) e quantas há; o serviço mais pedido nos últimos 90 dias.
    const since = new Date(Date.now() - 90 * 86_400_000);
    const [rating, popular] = await Promise.all([
      prisma.review.aggregate({ where: { barbershopId: shop.id }, _avg: { rating: true }, _count: { _all: true } }),
      prisma.appointment.groupBy({
        by: ["serviceId"],
        where: { barbershopId: shop.id, status: "DONE", date: { gte: since }, serviceId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { serviceId: "desc" } },
        take: 1,
      }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { saasPlan, saasStatus, trialEndsAt, saasExpiresAt, ...publicShop } = shop;
    return NextResponse.json({
      shop: {
        ...publicShop,
        rating: rating._count._all > 0 ? { average: rating._avg.rating ?? 0, count: rating._count._all } : null,
        popularServiceId: popular[0]?.serviceId ?? null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
