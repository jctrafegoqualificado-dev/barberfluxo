import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/phone";
import { handleReminderReply } from "@/lib/whatsapp/atendimento";

/**
 * POST /api/v1/barbershops/{slug}/reminder-reply
 * Body: { phone: string, text?: string, answer?: "YES" | "NO" }
 *
 * O n8n repassa a mensagem do cliente. Se for resposta ao lembrete (SIM/NÃO),
 * o sistema confirma ou cancela o próximo agendamento que recebeu lembrete.
 *
 * Sempre 200. `result`:
 *  - CONFIRMED / CANCELLED  → envie `replyText` ao cliente e encerre o fluxo.
 *  - CANCEL_BLOCKED         → envie `replyText`; a conversa já foi passada para a barbearia.
 *  - NOT_UNDERSTOOD / NOT_FOUND / DISABLED → não era resposta ao lembrete: siga com a IA.
 *
 * Autenticação: header `x-api-key` (PUBLIC_API_KEY), validado no middleware.
 * Guia do n8n: docs/redesign/n8n-integracao.md
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { phone, text, answer } = await req.json().catch(() => ({}));
    if (onlyDigits(phone).length < 10) {
      return NextResponse.json({ error: "Campo phone obrigatório (com DDD)" }, { status: 400 });
    }
    if (answer !== undefined && answer !== "YES" && answer !== "NO") {
      return NextResponse.json({ error: "answer deve ser YES ou NO" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({ where: { slug }, select: { id: true, active: true } });
    if (!shop || !shop.active) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    const result = await handleReminderReply({ barbershopId: shop.id, phone, text, answer });
    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error("[v1/reminder-reply]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
