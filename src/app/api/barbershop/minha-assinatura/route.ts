import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getEntitlements, GRACE_DAYS } from "@/lib/entitlements";
import { loadSaasPlans } from "@/lib/saasPlans.server";
import { saasCharge } from "@/lib/saasPlans";

/**
 * Tela "Minha assinatura": o que a barbearia paga pelo sistema.
 * Plano e situação, planos à venda (preços vivos), cobranças pagas e barbeiros na conta.
 * Pagamentos do SaaS = Payment da barbearia sem assinatura de cliente (mesma regra do /plataforma).
 */
export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const [shop, plans, payments, barbers] = await Promise.all([
      prisma.barbershop.findUnique({
        where: { id: barbershopId },
        select: { name: true, saasPlan: true, saasStatus: true, saasExpiresAt: true, trialEndsAt: true, mpSubscriptionId: true },
      }),
      loadSaasPlans(),
      prisma.payment.findMany({
        where: { barbershopId, subscriptionId: null },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, amount: true, method: true, status: true, paidAt: true, createdAt: true },
      }),
      prisma.barber.findMany({
        where: { barbershopId, active: true, archivedAt: null },
        select: { id: true, nickname: true, user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    const ent = getEntitlements(shop);
    // Conta de cada plano com a equipe de hoje (plano + barbeiros extras)
    const n = barbers.length;
    const plan = (k: "PRO" | "ELITE") => ({
      key: k, label: plans[k].label, tagline: plans[k].tagline, hasAI: plans[k].hasAI,
      monthlyPrice: plans[k].monthlyPrice, annualPriceMonthly: plans[k].annualPriceMonthly,
      includedBarbers: plans[k].includedBarbers, extraBarberMonthly: plans[k].extraBarberMonthly,
      extraBarberAnnualMonthly: plans[k].extraBarberAnnualMonthly,
      monthly: saasCharge(k, "monthly", n, plans),
      annual: plans[k].annualPriceMonthly != null ? saasCharge(k, "annual", n, plans) : null,
    });
    const current = shop.saasPlan === "PREMIUM" ? "ELITE" : shop.saasPlan;

    const res = NextResponse.json({
      name: shop.name,
      current: {
        plan: current,
        label: plans[current as "PRO"]?.label ?? null,
        isPaid: current === "PRO" || current === "ELITE",
        status: shop.saasStatus,
        reason: ent.reason, // active | grace | overdue | cancelled | none
        hasAccess: ent.hasAccess,
        expiresAt: shop.saasExpiresAt,
        // Assinatura do MP ("Gerar Link MP" na plataforma): cobra sozinha todo mês
        autoRenew: !!shop.mpSubscriptionId && shop.saasStatus !== "CANCELLED",
        graceUntil: shop.saasExpiresAt ? new Date(shop.saasExpiresAt.getTime() + GRACE_DAYS * 86_400_000) : null,
      },
      plans: [plan("PRO"), plan("ELITE")],
      payments,
      barbers: barbers.map((b) => ({ id: b.id, name: b.nickname || b.user.name })),
    });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
