/**
 * Vencimento do plano do SaaS depois de um pagamento aprovado.
 *
 * Renovou antes de vencer: o novo período começa no vencimento atual (não perde os dias
 * já pagos). Vencido, em carência ou primeira assinatura: começa hoje.
 * Usado por /api/payments/process-saas e /api/payments/webhook-saas.
 */
export function nextSaasExpiry(
  shop: { saasStatus: string; saasExpiresAt: Date | null } | null,
  cycle: "monthly" | "annual",
  now: Date = new Date()
): Date {
  const base = shop?.saasStatus === "ACTIVE" && shop.saasExpiresAt && shop.saasExpiresAt > now ? shop.saasExpiresAt : now;
  return cycle === "annual"
    ? new Date(base.getFullYear() + 1, base.getMonth(), base.getDate(), base.getHours(), base.getMinutes())
    : new Date(base.getFullYear(), base.getMonth() + 1, base.getDate(), base.getHours(), base.getMinutes());
}
