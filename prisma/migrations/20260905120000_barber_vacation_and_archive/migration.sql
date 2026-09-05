-- Separa "em férias" de "inativo" e adiciona arquivamento de profissionais.
--
-- Contexto: até aqui o botão de excluir apenas marcava active = false, e o painel
-- rotulava todo inativo como "Em Férias". Quem foi desativado por uma tentativa de
-- exclusão NÃO deve virar "de férias", por isso onVacation nasce false para todos.

ALTER TABLE "Barber" ADD COLUMN IF NOT EXISTS "onVacation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Barber" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Barber_barbershopId_archivedAt_idx" ON "Barber"("barbershopId", "archivedAt");
