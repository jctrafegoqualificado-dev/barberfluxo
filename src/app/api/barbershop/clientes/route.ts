import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireActiveSubscription, hashPassword } from "@/lib/auth";
import { startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { phoneVariants } from "@/lib/phone";
import { shopClientWhere, linkClientToShop } from "@/lib/shopClients";
import { averageInterval, clientRhythm, isFrequent, monthlyValue } from "@/lib/clientRhythm";

/** Meia-noite (UTC) do dia de hoje em São Paulo — agendamentos ficam em T12:00Z. */
function todaySP() {
  return new Date(new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date()) + "T00:00:00Z");
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let barbershopId = payload.barbershopId!;

    if (payload.role === "BARBER") {
      const barber = await prisma.barber.findUnique({ where: { userId: payload.id } });
      if (!barber) return NextResponse.json({ clientes: [] });
      barbershopId = barber.barbershopId;
    }

    const [shop, dbClients, upcoming, retention, barbers, reviewsAgg] = await Promise.all([
      prisma.barbershop.findUnique({
        where: { id: barbershopId },
        select: { slug: true, name: true, retentionEnabled: true, retentionDays: true },
      }),
      prisma.user.findMany({
        where: { role: "CLIENT", ...shopClientWhere(barbershopId) },
        select: {
          id: true, name: true, email: true, phone: true, isBlocked: true, birthday: true, createdAt: true,
          appointments: {
            where: { barbershopId, status: { in: ["DONE", "NO_SHOW"] } },
            orderBy: { date: "asc" },
            select: { date: true, price: true, status: true, barberId: true },
          },
          subscriptions: {
            where: { barbershopId, status: "ACTIVE" },
            select: { createdAt: true, plan: { select: { name: true, price: true } } },
          },
          shopLinks: { where: { barbershopId }, select: { createdAt: true } },
        },
      }),
      // Quem já tem horário marcado para frente não está "sumido"
      prisma.appointment.findMany({
        where: { barbershopId, status: { in: ["CONFIRMED", "PENDING"] }, date: { gte: todaySP() } },
        select: { clientId: true },
        distinct: ["clientId"],
      }),
      prisma.clientRetention.findMany({ where: { barbershopId }, select: { clientId: true, lastSentAt: true } }),
      prisma.barber.findMany({ where: { barbershopId }, select: { id: true, nickname: true, user: { select: { name: true } } } }),
      prisma.review.aggregate({ where: { barbershopId }, _avg: { rating: true }, _count: { _all: true } }),
    ]);

    const upcomingSet = new Set(upcoming.map((a) => a.clientId));
    const retentionMap = new Map(retention.map((r) => [r.clientId, r.lastSentAt]));
    const barberName = new Map(barbers.map((b) => [b.id, b.nickname || b.user.name.split(" ")[0]]));
    const fallbackDays = shop?.retentionDays ?? 45;

    const totalReviews = reviewsAgg._count._all;
    const moral = totalReviews > 0 ? Math.round((reviewsAgg._avg.rating ?? 0) * 10) / 10 : 5.0;

    const clientes = dbClients.map((u) => {
      const doneAppts = u.appointments.filter((a) => a.status === "DONE");
      const sortedVisits = doneAppts.map((a) => new Date(a.date));
      const totalSpent = doneAppts.reduce((sum, a) => sum + a.price, 0);
      const noShowCount = u.appointments.length - doneAppts.length;
      const firstVisit = sortedVisits[0] ?? null;
      const lastVisit = sortedVisits[sortedVisits.length - 1] ?? null;
      const thisMonthVisits = sortedVisits.filter((d) => d >= monthStart && d <= monthEnd).length;

      // "Cliente desde": primeira visita, assinatura ou cadastro nesta barbearia
      const since = [firstVisit, u.subscriptions[0]?.createdAt, u.shopLinks[0]?.createdAt]
        .filter((d): d is Date => !!d)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? u.createdAt;
      const isNew = since >= monthStart;

      const avgFrequency = averageInterval(sortedVisits);
      const daysSinceLastVisit = lastVisit ? differenceInDays(now, lastVisit) : null;
      const hasUpcoming = upcomingSet.has(u.id);
      const rhythm = clientRhythm({ visits: sortedVisits.length, avgFrequency, daysSinceLastVisit, hasUpcoming, fallbackDays });

      // Profissional que mais atendeu (empate: o mais recente)
      const barberCount = new Map<string, number>();
      for (const a of doneAppts) barberCount.set(a.barberId, (barberCount.get(a.barberId) ?? 0) + 1);
      let preferredBarberId: string | null = null;
      for (const a of [...doneAppts].reverse()) {
        if (!preferredBarberId || (barberCount.get(a.barberId) ?? 0) > (barberCount.get(preferredBarberId) ?? 0)) preferredBarberId = a.barberId;
      }

      const sub = u.subscriptions[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        isBlocked: u.isBlocked,
        birthday: u.birthday ? u.birthday.toISOString() : null,
        since: since.toISOString(),
        totalVisits: sortedVisits.length,
        totalSpent,
        thisMonthVisits,
        firstVisit: firstVisit?.toISOString() || null,
        lastVisit: lastVisit?.toISOString() || null,
        daysSinceLastVisit,
        avgFrequency,
        isNew,
        noShowCount,
        activePlan: sub?.plan?.name ?? null,
        planPrice: sub?.plan?.price ?? null,
        preferredBarber: preferredBarberId ? barberName.get(preferredBarberId) ?? null : null,
        hasUpcoming,
        expectedInterval: rhythm.expected,
        lapsed: rhythm.lapsed,
        overdueDays: rhythm.overdueDays,
        frequent: isFrequent(sortedVisits.length, avgFrequency, rhythm.lapsed),
        monthlyValue: Math.round(monthlyValue(totalSpent, sortedVisits.length, rhythm.expected)),
        lastRetentionAt: retentionMap.get(u.id)?.toISOString() ?? null,
      };
    });

    // Ordena por quem veio por último
    clientes.sort((a, b) => {
      const dateA = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
      const dateB = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({
      clientes,
      moral,
      shop: shop ? { slug: shop.slug, name: shop.name, retentionEnabled: shop.retentionEnabled, retentionDays: shop.retentionDays } : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    await requireActiveSubscription(barbershopId);
    const { name, phone, email, birthday } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const cleanPhone = phone ? phone.replace(/\D/g, "") : null;
    const finalEmail = email?.trim() || (cleanPhone ? `${cleanPhone}@cliente.iadebarbearia.com` : null);

    if (!finalEmail) {
      return NextResponse.json({ error: "Informe telefone ou e-mail" }, { status: 400 });
    }

    // O cadastro do cliente é compartilhado entre barbearias
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          ...(cleanPhone ? [{ phone: { in: phoneVariants(cleanPhone) } }] : []),
          { email: finalEmail },
        ],
        role: "CLIENT",
      },
      select: { id: true, name: true },
    });
    if (existing) {
      const alreadyHere = await prisma.user.count({ where: { id: existing.id, ...shopClientWhere(barbershopId) } });
      if (alreadyHere > 0) {
        return NextResponse.json({ error: `Esse telefone ou e-mail já é do cliente "${existing.name}".` }, { status: 409 });
      }
      // Já é cliente de outra barbearia (ou só agendou pelo link): passa a aparecer aqui também
      await linkClientToShop(existing.id, barbershopId, "MANUAL");
      return NextResponse.json({ client: existing, linked: true }, { status: 201 });
    }

    const password = await hashPassword(cleanPhone ?? name);
    const client = await prisma.user.create({
      data: {
        name: name.trim(),
        email: finalEmail,
        phone: cleanPhone ?? undefined,
        birthday: birthday ? new Date(birthday + "T12:00:00Z") : undefined,
        password,
        role: "CLIENT",
        shopLinks: { create: { barbershopId, source: "MANUAL" } },
      },
      select: { id: true, name: true },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : msg === "SUBSCRIPTION_REQUIRED" ? 402 : 500;
    const error = msg === "SUBSCRIPTION_REQUIRED" ? "Seu plano não está ativo. Assine para usar esta funcionalidade." : msg;
    return NextResponse.json({ error }, { status });
  }
}
