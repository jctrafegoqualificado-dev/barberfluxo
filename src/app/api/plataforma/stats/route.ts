import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requirePlatformAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);

    const now = new Date();
    const brDateStr = new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(now);
    const [brYear, brMonth] = brDateStr.split("-").map(Number);
    const startOfMonth = new Date(Date.UTC(brYear, brMonth - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(brYear, brMonth, 0, 23, 59, 59, 999));
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // All shops
    const shops = await prisma.barbershop.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        _count: { select: { appointments: true, barbers: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const totalShops = shops.length;
    const activeShops = shops.filter(s => s.active).length;
    const inactiveShops = totalShops - activeShops;

    // Plan distribution
    let mrr = 0;
    let basicCount = 0;
    let proCount = 0;
    let eliteCount = 0; // inclui PREMIUM legado
    shops.forEach(s => {
      if (s.active) {
        if (s.saasPlan === "BASIC") { basicCount++; }
        if (s.saasPlan === "PRO") { mrr += 154.9; proCount++; }
        if (s.saasPlan === "ELITE" || s.saasPlan === "PREMIUM") { mrr += 197.9; eliteCount++; }
      }
    });

    // Conversion rate (Basic → qualquer plano pago)
    const paidCount = proCount + eliteCount;
    const conversionRate = totalShops > 0 ? Math.round((paidCount / totalShops) * 100) : 0;

    // New in last 7 days
    const newLast7Days = shops.filter(s => new Date(s.createdAt) >= sevenDaysAgo).length;

    // New in last 30 days
    const newLast30Days = shops.filter(s => new Date(s.createdAt) >= thirtyDaysAgo).length;

    // Churn rate (inactive / total) — simplified
    const churnRate = totalShops > 0 ? Math.round((inactiveShops / totalShops) * 100) : 0;

    // SaaS Payments (all time + this month)
    const allSaasPayments = await prisma.payment.findMany({
      where: {
        barbershopId: { not: null },
        subscriptionId: null // Only SaaS payments, not client subscriptions
      },
      orderBy: { createdAt: "desc" },
      include: {
        barbershop: { select: { name: true, slug: true } }
      }
    });

    const saasPaymentsThisMonth = allSaasPayments.filter(p => {
      const d = new Date(p.createdAt);
      return d >= startOfMonth && d <= endOfMonth;
    });

    const saasRevenueThisMonth = saasPaymentsThisMonth
      .filter(p => p.status === "PAID")
      .reduce((acc, p) => acc + p.amount, 0);

    const saasRevenueTotal = allSaasPayments
      .filter(p => p.status === "PAID")
      .reduce((acc, p) => acc + p.amount, 0);

    // ── ARPU, LTV histórico, tenure médio ──────────────────────────────────
    const arpu = paidCount > 0 ? mrr / paidCount : 0;

    const uniquePayingShops = new Set(
      allSaasPayments.filter(p => p.status === "PAID" && p.barbershopId).map(p => p.barbershopId)
    ).size;
    const ltv = uniquePayingShops > 0 ? saasRevenueTotal / uniquePayingShops : 0;

    const paidActiveShops = shops.filter(
      s => s.active && (s.saasPlan === "PRO" || s.saasPlan === "ELITE" || s.saasPlan === "PREMIUM")
    );
    const avgTenureMonths = paidActiveShops.length > 0
      ? paidActiveShops.reduce((sum, s) => {
          return sum + (now.getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
        }, 0) / paidActiveShops.length
      : 0;

    // Weekly growth data (last 8 weeks)
    const weeklyGrowth = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const newInWeek = shops.filter(s => {
        const d = new Date(s.createdAt);
        return d >= weekStart && d < weekEnd;
      }).length;
      const label = `${weekStart.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`;
      weeklyGrowth.push({ label, newUsers: newInWeek, churned: 0 });
    }

    return NextResponse.json({
      mrr,
      totalShops,
      activeShops,
      inactiveShops,
      conversionRate,
      churnRate,
      newLast7Days,
      newLast30Days,
      planDistribution: { basic: basicCount, pro: proCount, elite: eliteCount },
      saasPayments: allSaasPayments,
      saasRevenueThisMonth,
      saasRevenueTotal,
      arpu,
      ltv,
      avgTenureMonths: Math.round(avgTenureMonths * 10) / 10,
      weeklyGrowth,
      shops
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
