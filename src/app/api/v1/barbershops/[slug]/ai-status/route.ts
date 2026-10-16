import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/phone";
import { getAiStatus } from "@/lib/whatsapp/atendimento";

/**
 * GET /api/v1/barbershops/{slug}/ai-status?phone=...
 *
 * O n8n consulta ANTES de responder cada mensagem. `aiPaused: true` = a conversa está
 * com a barbearia (handoff ou pausa pelo painel): não responda, só deixe a mensagem passar.
 *
 * Sempre 200: { aiPaused: boolean, until: string | null, reason: string | null }.
 * Autenticação: header `x-api-key` (PUBLIC_API_KEY). Guia: docs/redesign/n8n-integracao.md
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const phone = req.nextUrl.searchParams.get("phone");
    if (onlyDigits(phone).length < 10) {
      return NextResponse.json({ error: "Parâmetro phone obrigatório (com DDD)" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({ where: { slug }, select: { id: true, active: true } });
    if (!shop || !shop.active) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    return NextResponse.json(await getAiStatus(shop.id, phone!));
  } catch (e: unknown) {
    console.error("[v1/ai-status]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
