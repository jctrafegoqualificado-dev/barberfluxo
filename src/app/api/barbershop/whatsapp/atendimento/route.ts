import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { setContactAi } from "@/lib/whatsapp/atendimento";

// "Precisam de você": conversas que a IA passou para a barbearia (ou que o dono pausou).
// O n8n marca via /api/v1/barbershops/[slug]/handoff; aqui o dono vê e devolve para a IA.

function errorResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : "Erro interno";
  const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const contacts = await prisma.whatsAppContact.findMany({
      where: { barbershopId: payload.barbershopId!, aiPausedUntil: { gt: new Date() } },
      orderBy: { handoffAt: "desc" },
      select: {
        id: true, phone: true, pushName: true, handoffAt: true, handoffReason: true, aiPausedUntil: true,
        user: { select: { name: true } },
        messages: { where: { fromMe: false }, orderBy: { timestamp: "desc" }, take: 1, select: { textContent: true, timestamp: true } },
      },
    });
    return NextResponse.json({
      contacts: contacts.map(({ messages, user, ...c }) => ({
        ...c,
        name: user?.name ?? c.pushName ?? null,
        lastMessage: messages[0] ?? null,
      })),
    });
  } catch (e: unknown) {
    return errorResponse(e);
  }
}

// POST { contactId, action: "release" | "pause" }
export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { contactId, action } = await req.json();
    if (typeof contactId !== "string" || (action !== "release" && action !== "pause")) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    const result = await setContactAi(payload.barbershopId!, contactId, action);
    if (result.count === 0) return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return errorResponse(e);
  }
}
