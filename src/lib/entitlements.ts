/**
 * entitlements.ts — Fonte ÚNICA do que cada barbearia pode usar AGORA,
 * derivado do estado de assinatura.
 *
 * Modelo de negócio (PAYWALL — decisão do dono em 2026-06):
 *  - NÃO existe trial nem tier grátis. Para usar o sistema é preciso um
 *    plano pago ATIVO.
 *  - Plano "Gestão" (PRO): acesso full, SEM IA conversacional.
 *  - Plano "Gestão + Assistente" (ELITE/PREMIUM): acesso full + IA.
 *  - Carência de GRACE_DAYS dias após o vencimento de um plano pago antes de
 *    bloquear (para falha temporária de pagamento).
 *
 * Duas regras-mãe:
 *  - hasAccess: pode usar o sistema (painel, agendamento público, WhatsApp).
 *  - hasAI:     assistente conversacional liberado (plano com IA).
 *
 * ⚠️ Para a carência funcionar no vencimento, o cron check-saas-expiry NÃO deve
 *    rebaixar o plano imediatamente (ver fase de enforcement de bloqueio / Fase 2).
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
  | "active"
  | "grace"
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
  const paid = planIsPaid(shop.saasPlan);

  // 1. Plano pago e ATIVO → acesso liberado.
  //    (O cron check-saas-expiry é quem move ACTIVE → OVERDUE no vencimento;
  //     enquanto está ACTIVE, confiamos no status.)
  if (paid && shop.saasStatus === "ACTIVE") {
    return { hasAccess: true, hasAI: planHasAI(shop.saasPlan), reason: "active" };
  }

  // 2. Plano pago VENCIDO → carência de GRACE_DAYS a partir do vencimento.
  if (
    paid &&
    shop.saasStatus === "OVERDUE" &&
    shop.saasExpiresAt &&
    now.getTime() < shop.saasExpiresAt.getTime() + GRACE_MS
  ) {
    return { hasAccess: true, hasAI: planHasAI(shop.saasPlan), reason: "grace" };
  }

  // 3. Sem plano pago ativo → BLOQUEADO (paywall: sem trial, sem tier grátis).
  //    Cobre: PENDING (nunca assinou), BASIC, TRIAL legado, OVERDUE fora da
  //    carência, CANCELLED, PAUSED.
  const reason: EntitlementReason =
    shop.saasStatus === "OVERDUE"
      ? "overdue"
      : shop.saasStatus === "CANCELLED"
      ? "cancelled"
      : "none";
  return { hasAccess: false, hasAI: false, reason };
}
