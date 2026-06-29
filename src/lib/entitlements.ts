/**
 * entitlements.ts — Fonte ÚNICA do que cada barbearia pode usar AGORA,
 * derivado do estado de assinatura (trial / pago / vencido).
 *
 * Duas regras-mãe:
 *  - hasAccess: pode usar o sistema (painel, agendamento público, WhatsApp).
 *  - hasAI:     assistente conversacional liberado (trial OU plano com IA).
 *
 * Modelo de negócio:
 *  - Trial = acesso FULL (inclui IA) por 7 dias. Depois, bloqueia até assinar.
 *  - Plano "Gestão" (PRO): acesso full, SEM IA conversacional.
 *  - Plano "Gestão + Assistente" (ELITE/PREMIUM): acesso full + IA.
 *  - Carência de GRACE_DAYS dias após o vencimento de plano pago antes de bloquear.
 *
 * ⚠️ Para a carência funcionar no vencimento, o cron check-saas-expiry NÃO deve
 *    rebaixar o plano imediatamente (ver fase de enforcement de bloqueio).
 */
import { SAAS_PLANS, type SaasPlanKey } from "./saasPlans";

export const GRACE_DAYS = 3;
const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

export interface EntitlementInput {
  saasPlan: string;
  saasStatus: string;
  trialEndsAt: Date | null;
  saasExpiresAt: Date | null;
}

export type EntitlementReason =
  | "trial"
  | "active"
  | "grace"
  | "trial_expired"
  | "overdue"
  | "cancelled"
  | "none";

export interface Entitlements {
  /** Pode usar o sistema (painel, agendamento, WhatsApp). */
  hasAccess: boolean;
  /** Assistente de IA conversacional liberado. */
  hasAI: boolean;
  reason: EntitlementReason;
}

function planHasAI(plan: string): boolean {
  return SAAS_PLANS[plan as SaasPlanKey]?.hasAI ?? false;
}

function planIsPaid(plan: string): boolean {
  return SAAS_PLANS[plan as SaasPlanKey]?.isPaid ?? false;
}

export function getEntitlements(
  shop: EntitlementInput,
  now: Date = new Date()
): Entitlements {
  // 1. Trial — acesso full + IA enquanto não vence
  if (shop.saasStatus === "TRIAL") {
    if (shop.trialEndsAt && shop.trialEndsAt > now) {
      return { hasAccess: true, hasAI: true, reason: "trial" };
    }
    return { hasAccess: false, hasAI: false, reason: "trial_expired" };
  }

  // 2. Plano pago ativo
  if (shop.saasStatus === "ACTIVE" && planIsPaid(shop.saasPlan)) {
    if (!shop.saasExpiresAt || shop.saasExpiresAt > now) {
      return { hasAccess: true, hasAI: planHasAI(shop.saasPlan), reason: "active" };
    }
    // Venceu mas o cron ainda não processou → trata como carência
    if (now.getTime() < shop.saasExpiresAt.getTime() + GRACE_MS) {
      return { hasAccess: true, hasAI: planHasAI(shop.saasPlan), reason: "grace" };
    }
    return { hasAccess: false, hasAI: false, reason: "overdue" };
  }

  // 3. Vencido (OVERDUE) — carência a partir do vencimento
  if (shop.saasStatus === "OVERDUE") {
    if (
      shop.saasExpiresAt &&
      now.getTime() < shop.saasExpiresAt.getTime() + GRACE_MS
    ) {
      return { hasAccess: true, hasAI: planHasAI(shop.saasPlan), reason: "grace" };
    }
    return { hasAccess: false, hasAI: false, reason: "overdue" };
  }

  // 4. CANCELLED / PAUSED / desconhecido → bloqueado
  return {
    hasAccess: false,
    hasAI: false,
    reason: shop.saasStatus === "CANCELLED" ? "cancelled" : "none",
  };
}
