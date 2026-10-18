import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth";
import { PLATFORM_KEYS, getPlatformContact, normalizeWhatsapp } from "@/lib/platformSettings";

/** Configurações da plataforma: contato (WhatsApp e e-mail) da página de vendas. */
function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : "Erro interno";
  const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    return NextResponse.json(await getPlatformContact());
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const { whatsapp, email } = await req.json().catch(() => ({}));
    const wa = typeof whatsapp === "string" && whatsapp.trim() ? normalizeWhatsapp(whatsapp) : "";
    if (wa === null) return NextResponse.json({ error: "WhatsApp inválido. Use o número com DDD, ex.: 41 99999-0000" }, { status: 400 });
    const mail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (mail && !/^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/.test(mail)) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });

    const save = (key: string, value: string) => value
      ? prisma.platformSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
      : prisma.platformSetting.deleteMany({ where: { key } });
    await prisma.$transaction([save(PLATFORM_KEYS.whatsapp, wa), save(PLATFORM_KEYS.email, mail)]);
    return NextResponse.json(await getPlatformContact());
  } catch (e) {
    return fail(e);
  }
}
