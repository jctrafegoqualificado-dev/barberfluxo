import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";
import { LOYALTY_POINTS_PER_REVIEW } from "@/lib/loyalty";
import { currentMonthSP, monthStartSP } from "@/lib/monthResult";
import { startOfTodaySP } from "@/lib/cashSummary";

function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : "Erro interno";
  const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}

async function shopConfig(barbershopId: string) {
  const shop = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { loyaltyThreshold: true, loyaltyDiscountPercent: true },
  });
  return { loyaltyThreshold: shop?.loyaltyThreshold ?? 50, loyaltyDiscountPercent: shop?.loyaltyDiscountPercent ?? 10, pointsPerReview: LOYALTY_POINTS_PER_REVIEW };
}

/**
 * GET → ranking de pontos, indicadores, resgates recentes e o que os clientes acharam no mês.
 * GET ?clientId= → detalhe de um cliente (saldo, próximo horário, extrato de pontos).
 */
export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const config = await shopConfig(barbershopId);
    const clientId = new URL(req.url).searchParams.get("clientId");

    if (clientId) {
      const [agg, next, history] = await Promise.all([
        prisma.loyaltyPoint.aggregate({ where: { barbershopId, clientId }, _sum: { points: true } }),
        prisma.appointment.findFirst({
          where: { barbershopId, clientId, status: { in: ["CONFIRMED", "PENDING"] }, date: { gte: startOfTodaySP() } },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          select: {
            date: true, startTime: true,
            barber: { select: { nickname: true, user: { select: { name: true } } } },
            services: { select: { service: { select: { name: true } } } },
          },
        }),
        prisma.loyaltyPoint.findMany({
          where: { barbershopId, clientId }, orderBy: { createdAt: "desc" }, take: 8,
          select: { id: true, points: true, action: true, description: true, createdAt: true },
        }),
      ]);
      const res = NextResponse.json({ balance: agg._sum.points ?? 0, next, history, config });
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }

    const monthStart = monthStartSP(currentMonthSP());
    const [balances, earned, redeemed, reviews, comments] = await Promise.all([
      prisma.loyaltyPoint.groupBy({ by: ["clientId"], where: { barbershopId }, _sum: { points: true } }),
      prisma.loyaltyPoint.groupBy({ by: ["clientId"], where: { barbershopId, action: "EARNED" }, _count: { _all: true }, _max: { createdAt: true } }),
      prisma.loyaltyPoint.findMany({
        where: { barbershopId, action: "REDEEMED" }, orderBy: { createdAt: "desc" }, take: 30,
        select: { id: true, points: true, description: true, createdAt: true, client: { select: { id: true, name: true } } },
      }),
      prisma.review.findMany({
        where: { barbershopId, createdAt: { gte: monthStart } },
        select: { rating: true, barberId: true },
      }),
      prisma.review.findMany({
        where: { barbershopId, comment: { not: null } }, orderBy: { createdAt: "desc" }, take: 5,
        select: {
          id: true, rating: true, comment: true, createdAt: true,
          client: { select: { name: true, phone: true } },
          barber: { select: { nickname: true, user: { select: { name: true } } } },
        },
      }),
    ]);

    const withPoints = balances.filter((b) => (b._sum.points ?? 0) > 0);
    const people = await prisma.user.findMany({
      where: { id: { in: withPoints.map((b) => b.clientId) } },
      select: { id: true, name: true, phone: true },
    });
    const byId = new Map(people.map((u) => [u.id, u]));
    const earnedBy = new Map(earned.map((e) => [e.clientId, e]));
    const clients = withPoints
      .map((b) => {
        const u = byId.get(b.clientId);
        const e = earnedBy.get(b.clientId);
        return {
          clientId: b.clientId,
          name: u?.name ?? "—",
          phone: u?.phone ?? null,
          balance: b._sum.points ?? 0,
          reviews: e?._count._all ?? 0,
          lastReviewAt: e?._max.createdAt ?? null,
        };
      })
      .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));

    const t = config.loyaltyThreshold;
    const step = config.pointsPerReview;
    const redeemedMonth = redeemed.filter((r) => r.createdAt >= monthStart);

    // NPS do mês: % de 9–10 menos % de 0–6
    const n = reviews.length;
    const promoters = reviews.filter((r) => r.rating >= 9).length;
    const detractors = reviews.filter((r) => r.rating <= 6).length;
    const barberIds = [...new Set(reviews.map((r) => r.barberId).filter((x): x is string => !!x))];
    const barbers = barberIds.length
      ? await prisma.barber.findMany({ where: { id: { in: barberIds } }, select: { id: true, nickname: true, user: { select: { name: true } } } })
      : [];
    const byBarber = barbers
      .map((b) => {
        const rs = reviews.filter((r) => r.barberId === b.id);
        return { id: b.id, name: b.nickname || b.user.name.split(" ")[0], count: rs.length, avg: rs.reduce((s, r) => s + r.rating, 0) / rs.length };
      })
      .sort((a, b) => b.avg - a.avg || b.count - a.count);

    const res = NextResponse.json({
      config,
      clients,
      stats: {
        eligible: clients.filter((c) => c.balance >= t).length,
        near: clients.filter((c) => c.balance < t && c.balance >= t - step).length,
        withPoints: clients.length,
        pointsTotal: clients.reduce((s, c) => s + c.balance, 0),
        redeemedMonth: redeemedMonth.length,
        redeemedMonthPoints: redeemedMonth.reduce((s, r) => s + Math.abs(r.points), 0),
      },
      recent: redeemed.slice(0, 5).map((r) => ({ id: r.id, at: r.createdAt, points: Math.abs(r.points), description: r.description, name: r.client.name, clientId: r.client.id })),
      reviews: {
        count: n,
        avg: n ? reviews.reduce((s, r) => s + r.rating, 0) / n : null,
        nps: n ? Math.round(((promoters - detractors) / n) * 100) : null,
        promoters, passives: n - promoters - detractors, detractors,
        pointsGiven: n * step,
        byBarber,
        comments: comments.map((c) => ({
          id: c.id, rating: c.rating, comment: c.comment, at: c.createdAt,
          client: c.client.name, phone: c.client.phone,
          barber: c.barber ? c.barber.nickname || c.barber.user.name.split(" ")[0] : null,
        })),
      },
    });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e: unknown) {
    return fail(e);
  }
}

/** Resgate: tira {threshold} pontos do saldo e dá o desconto. */
export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { clientId } = await req.json();
    if (!clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });

    const { loyaltyThreshold, loyaltyDiscountPercent } = await shopConfig(barbershopId);
    const agg = await prisma.loyaltyPoint.aggregate({ where: { barbershopId, clientId }, _sum: { points: true } });
    const balance = agg._sum.points ?? 0;
    if (balance < loyaltyThreshold) {
      return NextResponse.json({ error: `Saldo insuficiente: precisa de ${loyaltyThreshold} pts e tem ${balance} pts.` }, { status: 400 });
    }

    const entry = await prisma.loyaltyPoint.create({
      data: {
        points: -loyaltyThreshold,
        action: "REDEEMED",
        description: `Resgate: ${loyaltyDiscountPercent}% de desconto`,
        clientId,
        barbershopId,
      },
    });

    void logAudit({
      barbershopId, userId: payload.id, userEmail: payload.email, userRole: payload.role,
      action: "CREATE", entity: "LoyaltyRedeem", entityId: entry.id,
      diff: { after: { clientId, points: -loyaltyThreshold, discount: loyaltyDiscountPercent } }, ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, entry, discountPercent: loyaltyDiscountPercent, newBalance: balance - loyaltyThreshold });
  } catch (e: unknown) {
    return fail(e);
  }
}

/** Desfaz um resgate (devolve os pontos). */
export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Resgate não informado" }, { status: 400 });

    const entry = await prisma.loyaltyPoint.findFirst({ where: { id, barbershopId, action: "REDEEMED" } });
    if (!entry) return NextResponse.json({ error: "Resgate não encontrado" }, { status: 404 });
    await prisma.loyaltyPoint.delete({ where: { id } });

    void logAudit({
      barbershopId, userId: payload.id, userEmail: payload.email, userRole: payload.role,
      action: "DELETE", entity: "LoyaltyRedeem", entityId: id,
      diff: { before: { clientId: entry.clientId, points: entry.points } }, ip: getClientIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return fail(e);
  }
}

/** Regras: quantos pontos valem 1 resgate e quanto de desconto. */
export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { loyaltyThreshold, loyaltyDiscountPercent } = await req.json();
    const threshold = Number(loyaltyThreshold);
    const discount = Number(loyaltyDiscountPercent);
    if (!Number.isInteger(threshold) || threshold < LOYALTY_POINTS_PER_REVIEW || threshold > 1000 || threshold % LOYALTY_POINTS_PER_REVIEW !== 0) {
      return NextResponse.json({ error: `Os pontos do resgate precisam ser múltiplos de ${LOYALTY_POINTS_PER_REVIEW} (entre ${LOYALTY_POINTS_PER_REVIEW} e 1000).` }, { status: 400 });
    }
    if (!(discount > 0 && discount <= 100)) return NextResponse.json({ error: "O desconto vai de 1 a 100%." }, { status: 400 });

    const before = await shopConfig(barbershopId);
    await prisma.barbershop.update({ where: { id: barbershopId }, data: { loyaltyThreshold: threshold, loyaltyDiscountPercent: discount } });

    void logAudit({
      barbershopId, userId: payload.id, userEmail: payload.email, userRole: payload.role,
      action: "UPDATE", entity: "LoyaltyRules", entityId: barbershopId,
      diff: { before: { threshold: before.loyaltyThreshold, discount: before.loyaltyDiscountPercent }, after: { threshold, discount } }, ip: getClientIp(req),
    });
    return NextResponse.json({ ok: true, config: { ...before, loyaltyThreshold: threshold, loyaltyDiscountPercent: discount } });
  } catch (e: unknown) {
    return fail(e);
  }
}
