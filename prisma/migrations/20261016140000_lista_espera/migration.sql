-- Redesign — Grupo 2: lista de espera do agendamento online.

CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "serviceIds" JSONB,
    "anyBarber" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "notifiedAt" TIMESTAMP(3),
    "notifiedSlot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "barbershopId" TEXT NOT NULL,
    "barberId" TEXT,
    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WaitlistEntry_barbershopId_date_status_idx" ON "WaitlistEntry"("barbershopId", "date", "status");
CREATE INDEX IF NOT EXISTS "WaitlistEntry_clientPhone_idx" ON "WaitlistEntry"("clientPhone");

DO $$ BEGIN
  ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_barbershopId_fkey"
    FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_barberId_fkey"
    FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
