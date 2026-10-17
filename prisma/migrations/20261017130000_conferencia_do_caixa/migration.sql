-- Caixa: quem abriu/fechou e a conferência do fechamento.
--
-- expectedBalance = quanto deveria ter na gaveta no fechamento (troco + entradas em
-- dinheiro − retiradas); com closingBalance (o que foi contado) dá a sobra/falta.
-- totalIn = quanto entrou no período, em todas as formas. Caixas antigos ficam nulos.

ALTER TABLE "CashFlowSession" ADD COLUMN IF NOT EXISTS "openedByName" TEXT;
ALTER TABLE "CashFlowSession" ADD COLUMN IF NOT EXISTS "closedByName" TEXT;
ALTER TABLE "CashFlowSession" ADD COLUMN IF NOT EXISTS "expectedBalance" DOUBLE PRECISION;
ALTER TABLE "CashFlowSession" ADD COLUMN IF NOT EXISTS "totalIn" DOUBLE PRECISION;

-- Hora em que o atendimento foi concluído. Antes o caixa só tinha "atualizado em",
-- que muda com qualquer edição. Atendimentos antigos ficam nulos (o caixa usa
-- updatedAt para eles).
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Appointment_barbershopId_completedAt_idx" ON "Appointment"("barbershopId", "completedAt");
