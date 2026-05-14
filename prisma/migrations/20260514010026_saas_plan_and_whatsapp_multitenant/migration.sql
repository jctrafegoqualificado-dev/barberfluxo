-- CreateEnum
CREATE TYPE "SaasPlan" AS ENUM ('BASIC', 'PREMIUM');

-- AlterTable
ALTER TABLE "Barbershop" ADD COLUMN     "saasPlan" "SaasPlan" NOT NULL DEFAULT 'BASIC';

-- CreateTable
CREATE TABLE "WhatsAppInstance" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "evolutionInstanceName" TEXT NOT NULL,
    "evolutionToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastQrCode" TEXT,
    "lastConnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppContact" (
    "id" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "phone" TEXT,
    "pushName" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "barbershopId" TEXT NOT NULL,
    "instanceId" TEXT,
    "userId" TEXT,

    CONSTRAINT "WhatsAppContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "evolutionId" TEXT NOT NULL,
    "fromMe" BOOLEAN NOT NULL,
    "messageType" TEXT NOT NULL,
    "textContent" TEXT,
    "rawPayload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactId" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "instanceId" TEXT,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppInstance_barbershopId_key" ON "WhatsAppInstance"("barbershopId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppInstance_evolutionInstanceName_key" ON "WhatsAppInstance"("evolutionInstanceName");

-- CreateIndex
CREATE INDEX "WhatsAppInstance_evolutionInstanceName_idx" ON "WhatsAppInstance"("evolutionInstanceName");

-- CreateIndex
CREATE INDEX "WhatsAppInstance_status_idx" ON "WhatsAppInstance"("status");

-- CreateIndex
CREATE INDEX "WhatsAppContact_phone_idx" ON "WhatsAppContact"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppContact_remoteJid_barbershopId_key" ON "WhatsAppContact"("remoteJid", "barbershopId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_evolutionId_key" ON "WhatsAppMessage"("evolutionId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_contactId_timestamp_idx" ON "WhatsAppMessage"("contactId", "timestamp");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_timestamp_idx" ON "WhatsAppMessage"("timestamp");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_barbershopId_timestamp_idx" ON "WhatsAppMessage"("barbershopId", "timestamp");

-- AddForeignKey
ALTER TABLE "WhatsAppInstance" ADD CONSTRAINT "WhatsAppInstance_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppContact" ADD CONSTRAINT "WhatsAppContact_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppContact" ADD CONSTRAINT "WhatsAppContact_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WhatsAppInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppContact" ADD CONSTRAINT "WhatsAppContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "WhatsAppContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WhatsAppInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
