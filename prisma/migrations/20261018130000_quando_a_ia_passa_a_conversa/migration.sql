-- Situações em que o atendente de IA passa a conversa para a barbearia (tela Atendente de IA).
-- Chaves de src/lib/whatsapp/handoffTriggers.ts; viram instrução no /api/v1/.../ai-config.

ALTER TABLE "Barbershop" ADD COLUMN IF NOT EXISTS "aiHandoffTriggers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
