-- De onde veio o agendamento: AI (atendente do WhatsApp, via API v1), LINK (página de
-- agendamento) ou PANEL (painel do dono ou do barbeiro). Antigos ficam nulos.
-- Usado na tela do WhatsApp ("horários marcados pela IA").

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "source" TEXT;
CREATE INDEX IF NOT EXISTS "Appointment_barbershopId_source_createdAt_idx" ON "Appointment"("barbershopId", "source", "createdAt");
