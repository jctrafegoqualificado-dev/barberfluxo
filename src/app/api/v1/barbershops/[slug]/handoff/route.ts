import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/phone";
import { requestHandoff } from "@/lib/whatsapp/atendimento";

/**
 * POST /api/v1/barbershops/{slug}/handoff
 * Body: { phone: string, reason: string, name?: string, pauseHours?: number }
 *
 * A IA passa a conversa para a barbearia: o contato aparece em "Precisam de você"
 * no painel (WhatsApp) e a IA fica pausada para ele por `pauseHours` (padrão 12h,
 * máx. 72h) — ou até o dono clicar em "Devolver para a IA".
 *
 * Use quando o cliente pedir desconto, reclamar, pedir para falar com uma pessoa,
 * ou quando a IA não souber responder. Depois de chamar, avise o cliente que a
 * equipe vai responder e NÃO responda mais (consulte /ai-status antes de cada resposta).
 *
 * Autenticação: header `x-api-key` (PUBLIC_API_KEY). Guia: docs/redesign/n8n-integracao.md
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { phone, reason, name, pauseHours } = await req.json().catch(() => ({}));
    if (onlyDigits(phone).length < 10) {
      return NextResponse.json({ error: "Campo phone obrigatório (com DDD)" }, { status: 400 });
    }
    if (typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json({ error: "Campo reason obrigatório (por que a conversa precisa da barbearia)" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({ where: { slug }, select: { id: true, active: true } });
    if (!shop || !shop.active) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    const contact = await requestHandoff({
      barbershopId: shop.id,
      phone,
      reason: reason.trim(),
      name: typeof name === "string" ? name : null,
      pauseHours: typeof pauseHours === "number" ? pauseHours : undefined,
    });
    return NextResponse.json({ ok: true, aiPausedUntil: contact.aiPausedUntil });
  } catch (e: unknown) {
    console.error("[v1/handoff]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
