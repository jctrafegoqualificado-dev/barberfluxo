-- Redesign — Grupo 2: recados do dono para a equipe, com controle de quem leu.

CREATE TABLE IF NOT EXISTS "TeamNotice" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "barbershopId" TEXT NOT NULL,
    CONSTRAINT "TeamNotice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TeamNotice_barbershopId_createdAt_idx" ON "TeamNotice"("barbershopId", "createdAt");

CREATE TABLE IF NOT EXISTS "TeamNoticeRead" (
    "id" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "noticeId" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    CONSTRAINT "TeamNoticeRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamNoticeRead_noticeId_barberId_key" ON "TeamNoticeRead"("noticeId", "barberId");

DO $$ BEGIN
  ALTER TABLE "TeamNotice" ADD CONSTRAINT "TeamNotice_barbershopId_fkey"
    FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TeamNoticeRead" ADD CONSTRAINT "TeamNoticeRead_noticeId_fkey"
    FOREIGN KEY ("noticeId") REFERENCES "TeamNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TeamNoticeRead" ADD CONSTRAINT "TeamNoticeRead_barberId_fkey"
    FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
