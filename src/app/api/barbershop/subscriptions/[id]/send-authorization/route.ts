/**
 * /api/barbershop/subscriptions/[id]/send-authorization
 *
 * Reenvia o link de autorização do débito automático (Mercado Pago Preapproval)
 * para o cliente via WhatsApp.
 *
 * Casos de uso:
 *  - Cliente não clicou no link enviado na criação da assinatura
 *  - Link expirou (MP links têm validade)
 *  - Cliente trocou de número e precisa receber em novo telefone
 *
 * POST → reenvia o link existente (authorizationLink) via WhatsApp
 * Retorna erro se:
 *  - Assinatura não pertence à barbearia
 *  - Já está AUTHORIZED (débito já ativo — não precisa reenviar)
 *  - Não tem link gerado (barbearia sem gateway configurado)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { sendWhatsAppNotification } from "@/lib/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;

    // Busca a assinatura garantindo que pertence a esta barbearia (CVE-10)
    const sub = await prisma.subscription.findFirst({
      where: { id, barbershopId },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        plan:   { select: { name: true } },
      },
    });

    if (!sub) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }

    const authStatus = (sub as any).authorizationStatus as string;
    const authLink   = (sub as any).authorizationLink   as string | null;

    // Já autorizado — não faz sentido reenviar
    if (authStatus === "AUTHORIZED") {
      return NextResponse.json(
        { error: "Esta assinatura já está com débito automático autorizado." },
        { status: 400 },
      );
    }

    // Sem link gerado — barbearia pode não ter gateway ou houve falha na criação
    if (!authLink) {
      return NextResponse.json(
        { error: "Nenhum link de autorização disponível. Verifique se o gateway de pagamento está configurado." },
        { status: 400 },
      );
    }

    // Sem telefone — não tem como enviar
    if (!sub.client.phone) {
      return NextResponse.json(
        { error: "Cliente sem WhatsApp cadastrado." },
        { status: 400 },
      );
    }

    // Busca nome da barbearia para a mensagem
    const barbershop = await prisma.barbershop.findUnique({
      where:  { id: barbershopId },
      select: { name: true },
    });

    // Envia via WhatsApp
    const result = await sendWhatsAppNotification(
      barbershopId,
      sub.client.phone,
      `🔔 *Autorize seu débito automático!*\n\n` +
      `Olá, ${sub.client.name}! Seu plano *${sub.plan.name}* na *${barbershop?.name ?? "barbearia"}* aguarda autorização.\n\n` +
      `Clique no link abaixo para ativar o débito automático via Mercado Pago:\n\n` +
      `👉 ${authLink}\n\n` +
      `_Após autorizar, as cobranças serão feitas automaticamente a cada ciclo. ✅_`,
    );

    // Atualiza authorizationSentAt independente do resultado do WhatsApp
    await prisma.subscription.update({
      where: { id },
      data:  { authorizationSentAt: new Date() } as any,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: `Link não enviado: ${result.reason}. Compartilhe manualmente: ${authLink}` },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Link de autorização enviado para ${sub.client.name} via WhatsApp.`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
