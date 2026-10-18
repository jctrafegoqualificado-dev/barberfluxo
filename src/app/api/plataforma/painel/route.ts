import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { loadSaasPlans } from "@/lib/saasPlans.server";
import { saasCharge } from "@/lib/saasPlans";

/**
 * Painel da plataforma (docs/design/Plataforma-desktop): o que entra por mês, quem está em dia,
 * quem precisa de atenção e a lista de barbearias.
 *
 * Só números que o sistema realmente tem:
 * - "Recebe por mês" = soma da mensalidade de quem está com acesso pago (anual conta o valor
 *   mensal equivalente; o ciclo sai do valor do último pagamento).
 * - Barras = dinheiro recebido em cada mês (pagamentos confirmados).
 * - Não existe data de cancelamento: "atrasadas" = venceu e não renovou.
 * Pagamento do SaaS = Payment da barbearia sem assinatura de cliente.
 */

const DAY = 86_400_000;
const monthKeySP = (d: Date) => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(d).slice(0, 7);

export type Situacao = "em_dia" | "vence" | "carencia" | "atrasada" | "sem_plano" | "desativada";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const now = new Date();

    const [shops, payments, lastAppt, plans] = await Promise.all([
      prisma.barbershop.findMany({
        select: {
          id: true, name: true, slug: true, active: true, createdAt: true, city: true,
          saasPlan: true, saasStatus: true, saasExpiresAt: true, trialEndsAt: true, aiAtendimentoAtivo: true,
          owner: { select: { name: true, email: true, phone: true } },
          whatsappInstance: { select: { status: true } },
          _count: { select: { barbers: { where: { active: true, archivedAt: null } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.findMany({
        where: { barbershopId: { not: null }, subscriptionId: null, status: "PAID" },
        select: { barbershopId: true, amount: true, paidAt: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.appointment.groupBy({ by: ["barbershopId"], _max: { createdAt: true } }),
      loadSaasPlans(),
    ]);

    const lastActivity = new Map(lastAppt.map((a) => [a.barbershopId, a._max.createdAt]));
    const byShop = new Map<string, { first: Date; last: { amount: number; at: Date }; total: number }>();
    for (const p of payments) {
      const at = p.paidAt ?? p.createdAt;
      const cur = byShop.get(p.barbershopId!);
      if (!cur) byShop.set(p.barbershopId!, { first: at, last: { amount: p.amount, at }, total: p.amount });
      else { cur.last = { amount: p.amount, at }; cur.total += p.amount; }
    }

    const rows = shops.map((s) => {
      const ent = getEntitlements(s, now);
      const planKey = s.saasPlan === "PREMIUM" ? "ELITE" : s.saasPlan;
      const def = plans[planKey as "PRO" | "ELITE"];
      const paidPlan = planKey === "PRO" || planKey === "ELITE";
      const pay = byShop.get(s.id);
      // Ciclo pelo valor do último pagamento (o mais perto entre a conta mensal e a anual, com extras)
      const m = paidPlan ? saasCharge(planKey, "monthly", s._count.barbers, plans) : null;
      const a = paidPlan && def?.annualPriceMonthly != null ? saasCharge(planKey, "annual", s._count.barbers, plans) : null;
      const annual = !!(pay && a && m && Math.abs(pay.last.amount - a.total) < Math.abs(pay.last.amount - m.total));
      const fee = (annual ? a?.perMonth : m?.perMonth) ?? 0;
      const daysLeft = s.saasExpiresAt ? Math.ceil((s.saasExpiresAt.getTime() - now.getTime()) / DAY) : null;

      let situacao: Situacao;
      if (!s.active) situacao = "desativada";
      else if (ent.reason === "active") situacao = daysLeft != null && daysLeft <= 7 ? "vence" : "em_dia";
      else if (ent.reason === "grace") situacao = "carencia";
      else if (pay || s.saasStatus === "OVERDUE" || s.saasStatus === "CANCELLED") situacao = "atrasada";
      else situacao = "sem_plano";

      return {
        id: s.id, name: s.name, slug: s.slug, city: s.city, createdAt: s.createdAt,
        owner: s.owner ? { name: s.owner.name, email: s.owner.email } : null,
        plan: paidPlan ? planKey : s.saasPlan, planLabel: paidPlan ? def?.label ?? planKey : null, annual,
        barbers: s._count.barbers,
        situacao, expiresAt: s.saasExpiresAt, daysLeft,
        whatsapp: s.whatsappInstance?.status ?? "NONE",
        ia: ent.hasAI ? (s.aiAtendimentoAtivo ? "on" : "off") : "sem_plano",
        lastActivity: lastActivity.get(s.id) ?? null,
        fee, billing: ent.hasAccess && paidPlan && s.active,
        paidTotal: pay?.total ?? 0, firstPaidAt: pay?.first ?? null,
      };
    });

    // ── Números ────────────────────────────────────────────────────────────
    const billing = rows.filter((r) => r.billing);
    const mrr = billing.reduce((s, r) => s + r.fee, 0);
    const thisMonth = monthKeySP(now);
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); months.push(monthKeySP(d)); }
    const received = new Map<string, { value: number; count: number }>(months.map((m) => [m, { value: 0, count: 0 }]));
    for (const p of payments) {
      const r = received.get(monthKeySP(p.paidAt ?? p.createdAt));
      if (r) { r.value += p.amount; r.count++; }
    }
    const cut30 = new Date(now.getTime() - 30 * DAY);
    const novos = rows.filter((r) => new Date(r.createdAt) >= cut30);
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const end = new Date(now.getTime() - (7 - i) * 7 * DAY);
      const start = new Date(end.getTime() - 7 * DAY);
      const inWeek = (d: Date | null) => !!d && d >= start && d < end;
      return {
        start: start.toISOString(),
        cadastros: rows.filter((r) => inWeek(new Date(r.createdAt))).length,
        primeiroPagamento: rows.filter((r) => inWeek(r.firstPaidAt)).length,
      };
    });
    const everPaid = rows.filter((r) => r.paidTotal > 0);
    const tenure = billing.filter((r) => r.firstPaidAt).map((r) => (now.getTime() - r.firstPaidAt!.getTime()) / (30 * DAY));
    const planMix = (["ELITE", "PRO"] as const).map((k) => {
      const list = billing.filter((r) => r.plan === k);
      return { key: k, label: plans[k].label, count: list.length, value: list.reduce((s, r) => s + r.fee, 0) };
    });

    // ── Precisa de atenção ────────────────────────────────────────────────
    const alerts = [
      ...rows.filter((r) => r.situacao === "carencia").map((r) => ({ tone: "danger", shopId: r.id, title: `${r.name} venceu e está na carência`, sub: "Se não renovar, o acesso pausa em poucos dias", action: "Ver" })),
      ...rows.filter((r) => r.situacao === "vence" && (r.daysLeft ?? 99) <= 3).map((r) => ({ tone: "warning", shopId: r.id, title: `${r.name} vence em ${r.daysLeft} ${r.daysLeft === 1 ? "dia" : "dias"}`, sub: "O sistema avisa o dono no WhatsApp 3 dias antes", action: "Ver" })),
      ...rows.filter((r) => r.billing && r.ia !== "sem_plano" && r.whatsapp !== "CONNECTED").map((r) => ({ tone: "warning", shopId: r.id, title: `${r.name} paga a IA, mas o WhatsApp não está conectado`, sub: "O atendente e os lembretes não funcionam assim", action: "Ver" })),
      ...rows.filter((r) => r.situacao === "sem_plano" && new Date(r.createdAt) >= new Date(now.getTime() - 7 * DAY)).map((r) => ({ tone: "info", shopId: r.id, title: `${r.name} se cadastrou e ainda não pagou`, sub: `Cadastro em ${new Date(r.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, action: "Ver" })),
    ];

    const res = NextResponse.json({
      updatedAt: now.toISOString(),
      kpis: {
        mrr, paying: billing.length, avgFee: billing.length ? mrr / billing.length : 0,
        receivedThisMonth: received.get(thisMonth)?.value ?? 0, paymentsThisMonth: received.get(thisMonth)?.count ?? 0,
        lastMonthReceived: received.get(months[4])?.value ?? 0,
        atrasadas: rows.filter((r) => r.situacao === "atrasada").length, carencia: rows.filter((r) => r.situacao === "carencia").length,
        novos30: novos.length, novos30Pagaram: novos.filter((r) => r.paidTotal > 0).length,
      },
      receivedByMonth: months.map((m) => ({ month: m, ...received.get(m)! })),
      weeks,
      planMix,
      annualCount: billing.filter((r) => r.annual).length,
      avgTenureMonths: tenure.length ? Math.round((tenure.reduce((a, b) => a + b, 0) / tenure.length) * 10) / 10 : 0,
      ltv: everPaid.length ? everPaid.reduce((s, r) => s + r.paidTotal, 0) / everPaid.length : 0,
      alerts,
      shops: rows,
    });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
