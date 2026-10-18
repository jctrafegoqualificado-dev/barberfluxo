/**
 * Quando o atendente de IA passa a conversa para a barbearia (Barbershop.aiHandoffTriggers).
 * A tela "Atendente de IA" liga/desliga; o /api/v1/.../ai-config transforma em instrução para o n8n,
 * que chama /handoff nessas situações.
 */
export const HANDOFF_TRIGGERS = [
  ["desconto", "Pedir desconto", "pedir desconto ou negociar preço"],
  ["reclamacao", "Reclamar de algo", "reclamar de um atendimento, serviço ou cobrança"],
  ["humano", "Pedir para falar com alguém", "pedir para falar com uma pessoa da equipe"],
  ["servico_inexistente", "Pedir serviço que não temos", "pedir um serviço que não está na lista de serviços"],
] as const;

export type HandoffTrigger = (typeof HANDOFF_TRIGGERS)[number][0];
export const DEFAULT_HANDOFF_TRIGGERS: HandoffTrigger[] = ["desconto", "reclamacao", "humano"];

export function cleanHandoffTriggers(v: unknown): HandoffTrigger[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const keys = HANDOFF_TRIGGERS.map((t) => t[0]) as readonly string[];
  return [...new Set(v.filter((k): k is HandoffTrigger => typeof k === "string" && keys.includes(k)))];
}

/** Frase para o prompt do atendente (vazio quando nada está marcado). */
export function handoffInstruction(triggers: string[]): string {
  const parts = HANDOFF_TRIGGERS.filter(([k]) => triggers.includes(k)).map(([, , text]) => text);
  if (!parts.length) return "";
  return `Passe a conversa para a equipe da barbearia (ferramenta de handoff) quando o cliente: ${parts.join("; ")}. Depois avise o cliente que alguém da equipe vai responder.`;
}
