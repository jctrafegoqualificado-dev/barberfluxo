-- Redesign — Grupo 2: confirmação SIM/NÃO do lembrete e passagem da conversa para humano.
-- Tudo nasce neutro: nenhum agendamento confirmado, nenhuma conversa pausada.

ALTER TABLE "Barbershop" ADD COLUMN IF NOT EXISTS "reminderAskConfirmation" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "confirmedVia" TEXT;

ALTER TABLE "WhatsAppContact" ADD COLUMN IF NOT EXISTS "aiPausedUntil" TIMESTAMP(3);
ALTER TABLE "WhatsAppContact" ADD COLUMN IF NOT EXISTS "handoffAt" TIMESTAMP(3);
ALTER TABLE "WhatsAppContact" ADD COLUMN IF NOT EXISTS "handoffReason" TEXT;
