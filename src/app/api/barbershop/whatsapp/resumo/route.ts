import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfTodaySP } from "@/lib/cashSummary";

/**
 * Tela do WhatsApp (visão geral): conexão, atendente de IA ligado/desligado e o dia de hoje —
 * conversas, horários marcados pela IA (Appointment.source = "AI") e quem precisa de você.
 * PATCH { aiAtendimentoAtivo } liga/desliga a IA.
 */

function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : "Erro interno";
  const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const since = startOfTodaySP();
    const now = new Date();

    const [shop, instance, contacts, aiAppts, lastMsg] = await Promise.all([
      prisma.barbershop.findUnique({ where: { id: barbershopId }, select: { aiAtendimentoAtivo: true, aiAssistantName: true, phone: true, name: true } }),
      prisma.whatsAppInstance.findUnique({ where: { barbershopId }, select: { status: true, lastConnectedAt: true } }),
      // Quem mandou mensagem hoje (conversa do dia) + quem está esperando a barbearia
      prisma.whatsAppContact.findMany({
        where: { barbershopId, OR: [{ messages: { some: { timestamp: { gte: since }, fromMe: false } } }, { aiPausedUntil: { gt: now } }] },
        select: {
          id: true, phone: true, pushName: true, aiPausedUntil: true, handoffAt: true, handoffReason: true, userId: true,
          user: { select: { name: true } },
          messages: { orderBy: { timestamp: "desc" }, take: 1, select: { textContent: true, timestamp: true, fromMe: true } },
        },
        take: 200,
      }),
      prisma.appointment.findMany({
        where: { barbershopId, source: "AI", createdAt: { gte: since }, status: { not: "CANCELLED" } },
        select: { clientId: true, price: true, startTime: true, date: true },
      }),
      prisma.whatsAppMessage.findFirst({ where: { barbershopId }, orderBy: { timestamp: "desc" }, select: { timestamp: true } }),
    ]);

    const bookedBy = new Map(aiAppts.map((a) => [a.clientId, a]));
    const convs = contacts
      .map((c) => {
        const paused = !!c.aiPausedUntil && c.aiPausedUntil > now;
        const booked = c.userId ? bookedBy.get(c.userId) : undefined;
        const last = c.messages[0] ?? null;
        return {
          id: c.id,
          name: c.user?.name ?? c.pushName ?? c.phone ?? "Contato",
          phone: c.phone,
          lastMessage: last?.textContent ?? null,
          lastFromMe: last?.fromMe ?? false,
          at: (last?.timestamp ?? c.handoffAt)?.toISOString() ?? null,
          status: paused ? "human" : booked ? "booked" : "ai",
          handoffReason: paused ? c.handoffReason : null,
          booked: booked ? { startTime: booked.startTime, date: booked.date.toISOString().slice(0, 10) } : null,
        };
      })
      .sort((a, b) => (a.status === "human" ? 0 : 1) - (b.status === "human" ? 0 : 1) || (b.at ?? "").localeCompare(a.at ?? ""));

    const res = NextResponse.json({
      connection: { status: instance?.status ?? "NONE", lastConnectedAt: instance?.lastConnectedAt ?? null, lastMessageAt: lastMsg?.timestamp ?? null, phone: shop?.phone ?? null },
      ai: { on: shop?.aiAtendimentoAtivo ?? true, name: shop?.aiAssistantName ?? null },
      today: {
        conversations: contacts.filter((c) => c.messages[0] && c.messages[0].timestamp >= since).length,
        aiBooked: aiAppts.length,
        aiBookedValue: aiAppts.reduce((s, a) => s + a.price, 0),
        needYou: convs.filter((c) => c.status === "human").length,
      },
      conversations: convs,
    });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { aiAtendimentoAtivo } = await req.json();
    if (typeof aiAtendimentoAtivo !== "boolean") return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    await prisma.barbershop.update({ where: { id: payload.barbershopId! }, data: { aiAtendimentoAtivo } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
