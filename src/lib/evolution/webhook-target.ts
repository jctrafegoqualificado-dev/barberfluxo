/**
 * webhook-target.ts — Decide para onde o webhook da instância Evolution aponta,
 * conforme a entitlement de IA da barbearia (gate A).
 *
 *  - hasAI  → N8N (assistente conversacional responde às mensagens recebidas).
 *  - sem IA → nossa rota /api/evolution/webhook (apenas salva a mensagem; não responde).
 *
 * Assim o gate de IA fica cravado no ROTEAMENTO, sem depender da lógica do n8n.
 * (Os lembretes/automações são enviados pelo CRM via /message/sendText — saída —
 *  e não dependem do webhook, então continuam funcionando no plano sem IA.)
 */
import { getEntitlements, type EntitlementInput } from "@/lib/entitlements";

/** URL pública da nossa app (para o webhook "save-only"). */
export function appBaseUrl(): string | null {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : null)
  );
}

/**
 * URL de webhook que a instância deve usar conforme a entitlement de IA.
 * Retorna "" quando não há URL configurável (chamador deve pular o setWebhook).
 */
export function resolveWebhookUrl(shop: EntitlementInput): string {
  const { hasAI } = getEntitlements(shop);

  if (hasAI) {
    return process.env.N8N_EVOLUTION_WEBHOOK_URL ?? "";
  }

  const base = appBaseUrl();
  return base ? `${base}/api/evolution/webhook` : "";
}
