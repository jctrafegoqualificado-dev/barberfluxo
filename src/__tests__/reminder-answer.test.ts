import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { parseReminderAnswer } from "@/lib/whatsapp/atendimento";

describe("parseReminderAnswer — resposta ao lembrete", () => {
  it.each(["sim", "Sim", "SIM!", "s", "Sim, obrigado!", "confirmo", "Ok", "👍", "sim, estarei lá", "Confirmado"])(
    "%s → SIM",
    (t) => expect(parseReminderAnswer(t)).toBe("YES")
  );

  it.each(["não", "Não", "nao", "N", "não vou poder", "Não posso ir", "cancela", "Cancelar por favor", "❌"])(
    "%s → NÃO",
    (t) => expect(parseReminderAnswer(t)).toBe("NO")
  );

  it.each([
    "sim, mas dá pra mudar pra 15h",  // tem outro assunto
    "posso ir às 16h?",                // pergunta
    "quanto custa a barba",            // não é resposta
    "sim não",                         // contraditório
    "simone",                          // palavra que começa com "sim"
    "",
    null,
  ])("%s → não entendido (a IA segue a conversa)", (t) => expect(parseReminderAnswer(t)).toBeNull());
});
