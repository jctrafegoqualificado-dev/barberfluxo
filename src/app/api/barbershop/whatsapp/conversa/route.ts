import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { sendMessage } from "@/lib/evolution/client";
import { DEFAULT_PAUSE_HOURS } from "@/lib/whatsapp/atendimento";

/**
 * Uma conversa do WhatsApp no painel.
 * GET ?contactId= → últimas mensagens.
 * POST { contactId, text } → a barbearia responde pelo painel; a IA fica pausada nessa
 * conversa (para não responder por cima) até alguém devolver para ela.
 */

function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : "Erro interno";
  const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const contactId = req.nextUrl.searchParams.get("contactId") ?? "";
    const contact = await prisma.whatsAppContact.findFirst({
      where: { id: contactId, barbershopId: payload.barbershopId! },
      select: {
        id: true, phone: true, pushName: true, aiPausedUntil: true, handoffReason: true, handoffAt: true,
        user: { select: { name: true } },
        messages: { orderBy: { timestamp: "desc" }, take: 40, select: { id: true, fromMe: true, textContent: true, messageType: true, timestamp: true } },
      },
    });
    if (!contact) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    const res = NextResponse.json({
      contact: {
        id: contact.id, phone: contact.phone, name: contact.user?.name ?? contact.pushName ?? contact.phone,
        paused: !!contact.aiPausedUntil && contact.aiPausedUntil > new Date(),
        handoffReason: contact.handoffReason, handoffAt: contact.handoffAt,
      },
      messages: contact.messages.reverse(),
    });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { contactId, text } = await req.json();
    const body = typeof text === "string" ? text.trim() : "";
    if (!contactId || !body) return NextResponse.json({ error: "Escreva a mensagem" }, { status: 400 });
    if (body.length > 2000) return NextResponse.json({ error: "Mensagem muito longa" }, { status: 400 });

    const [contact, instance] = await Promise.all([
      prisma.whatsAppContact.findFirst({ where: { id: contactId, barbershopId }, select: { id: true, remoteJid: true, phone: true } }),
      prisma.whatsAppInstance.findUnique({ where: { barbershopId }, select: { evolutionInstanceName: true, evolutionToken: true, status: true } }),
    ]);
    if (!contact) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    if (!instance || instance.status !== "CONNECTED") return NextResponse.json({ error: "O WhatsApp não está conectado" }, { status: 409 });

    const sent = await sendMessage(instance.evolutionInstanceName, contact.remoteJid || contact.phone || "", body, 0, instance.evolutionToken);
    if ("error" in sent) return NextResponse.json({ error: "O WhatsApp não aceitou a mensagem. Tente de novo." }, { status: 502 });

    // A barbearia assumiu a conversa: a IA não responde por cima
    await prisma.whatsAppContact.update({
      where: { id: contact.id },
      data: { aiPausedUntil: new Date(Date.now() + DEFAULT_PAUSE_HOURS * 3_600_000), handoffAt: new Date(), handoffReason: "Respondida pelo painel" },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
