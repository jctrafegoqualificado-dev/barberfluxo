-- Configurações da própria plataforma, editadas em /plataforma/configuracoes
-- (ex.: WhatsApp e e-mail de contato mostrados na página de vendas).

CREATE TABLE IF NOT EXISTS "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);
