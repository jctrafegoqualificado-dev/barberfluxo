-- Vínculo cliente ↔ barbearia para quem foi cadastrado à mão ou importado de planilha.
--
-- Antes, "Novo cliente" e "Importar planilha" criavam o cadastro (User) sem nenhum
-- vínculo com a barbearia; como a lista de clientes só mostra quem já agendou ou
-- assinou, esse cliente simplesmente sumia. Nada muda para quem já aparece.

CREATE TABLE IF NOT EXISTS "ShopClient" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    CONSTRAINT "ShopClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopClient_clientId_barbershopId_key" ON "ShopClient"("clientId", "barbershopId");
CREATE INDEX IF NOT EXISTS "ShopClient_barbershopId_idx" ON "ShopClient"("barbershopId");

DO $$ BEGIN
  ALTER TABLE "ShopClient" ADD CONSTRAINT "ShopClient_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ShopClient" ADD CONSTRAINT "ShopClient_barbershopId_fkey"
    FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
