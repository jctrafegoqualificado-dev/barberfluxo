-- Redesign — Grupo 1: gorjeta, check-in, observações do cliente e serviço fora do link online.
--
-- Tudo nasce com valor neutro (gorjeta 0, sem check-in, serviço visível online),
-- então o comportamento atual não muda para ninguém.

-- Gorjeta da comanda (100% do barbeiro, fora do faturamento e da base de comissão)
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "tipAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "tipPaymentMethod" TEXT;

-- Check-in: botão "Chegou" da agenda
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "arrivedAt" TIMESTAMP(3);

-- Serviço que não aparece no link de agendamento online
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "onlineBooking" BOOLEAN NOT NULL DEFAULT true;

-- Observações da barbearia sobre o cliente
CREATE TABLE IF NOT EXISTS "ClientNote" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "clientId" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    CONSTRAINT "ClientNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientNote_clientId_barbershopId_key" ON "ClientNote"("clientId", "barbershopId");

DO $$ BEGIN
  ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_barbershopId_fkey"
    FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
