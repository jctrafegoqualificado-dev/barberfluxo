-- Horário de atendimento próprio de cada barbeiro (igual para a semana toda).
--
-- Nulo = o barbeiro segue o horário de funcionamento da barbearia, que é o
-- comportamento atual. Por isso as colunas nascem vazias para todos.

ALTER TABLE "Barber" ADD COLUMN IF NOT EXISTS "workStart" TEXT;
ALTER TABLE "Barber" ADD COLUMN IF NOT EXISTS "workEnd" TEXT;
