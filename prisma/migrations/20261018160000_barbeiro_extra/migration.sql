-- Cobrança por barbeiro extra no plano do SaaS: o plano inclui N barbeiros e cada um a mais
-- soma um valor por mês (outro valor no anual). Editável em Planos e preços da plataforma.
-- Gestão + Atendente de IA (ELITE e o PREMIUM legado): 2 inclusos, R$ 33,90 / R$ 29,90 no anual.

ALTER TABLE "SaasPlanConfig" ADD COLUMN IF NOT EXISTS "includedBarbers" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SaasPlanConfig" ADD COLUMN IF NOT EXISTS "extraBarberMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SaasPlanConfig" ADD COLUMN IF NOT EXISTS "extraBarberAnnualMonthly" DOUBLE PRECISION;

UPDATE "SaasPlanConfig" SET "includedBarbers" = 2, "extraBarberMonthly" = 33.9, "extraBarberAnnualMonthly" = 29.9
WHERE "key" IN ('ELITE', 'PREMIUM') AND "extraBarberMonthly" = 0;
