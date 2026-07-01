import { NextRequest, NextResponse } from "next/server";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { setCronHealth } from "@/lib/cron-health";
import { sendWhatsAppNotification } from "@/lib/notifications";

/**
 * subscription-prebilling — Lembrete de PRÉ-vencimento da assinatura
 *
 * Avisa por WhatsApp, N dias antes do vencimento, os assinantes que pagam
 * MANUALMENTE (PIX/dinheiro/cartão) — reforçando a importância de manter em dia
 * para não perder os benefícios. Quem tem débito automático (MP AUTHORIZED) é
 * ignorado: o cartão é cobrado sozinho e o aviso viraria ruído.
 *
 * N é configurável por barbearia (`prebillingReminderDays`, padrão 5) e o
 * lembrete pode ser desligado (`prebillingReminderEnabled`).
 *
 * Executa diariamente. Proteção: CRON_SECRET obrigatório.
 */
const METHOD_LABEL: Record<string, string> = { PIX: "PIX", CASH: "Dinheiro", CARD: "Cartão" };
const MAX_WINDOW_DAYS = 31; // teto de busca; o filtro fino é por barbearia

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    console.error("[subscription-prebilling] CRON_SECRET não configurado — endpoint bloqueado");
    return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const provided = authHeader?.replace("Bearer ", "").trim() ?? querySecret;
  if (provided !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + MAX_WINDOW_DAYS);

  try {
    // Assinaturas ativas, MANUAIS (não débito automático), que vencem dentro da janela
    const subs = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        authorizationStatus: { not: "AUTHORIZED" },
        nextBillingDate: { gte: now, lte: windowEnd },
      },
      select: {
        id: true,
        nextBillingDate: true,
        billingDay: true,
        paymentMethod: true,
        barbershopId: true,
        client: { select: { name: true, phone: true } },
        plan: { select: { name: true, price: true } },
        barbershop: {
          select: { name: true, prebillingReminderEnabled: true, prebillingReminderDays: true },
        },
      },
    });

    let sent = 0;
    let skipped = 0;

    for (const sub of subs) {
      const shop = sub.barbershop;
      if (!shop.prebillingReminderEnabled) { skipped++; continue; }
      if (!sub.client.phone) { skipped++; continue; }

      const daysUntil = differenceInCalendarDays(sub.nextBillingDate, now);
      if (daysUntil !== shop.prebillingReminderDays) { skipped++; continue; }

      const firstName = sub.client.name.split(" ")[0];
      const price = sub.plan.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const dia = sub.billingDay ?? sub.nextBillingDate.getUTCDate();
      const methodLabel = METHOD_LABEL[sub.paymentMethod ?? "PIX"] ?? "PIX";
      const msg = [
        `Olá, ${firstName}! 👋`,
        ``,
        `Passando para lembrar: sua assinatura *${sub.plan.name}* no(a) *${shop.name}* vence em *${daysUntil} dia${daysUntil === 1 ? "" : "s"}*, no dia *${dia}*.`,
        ``,
        `Valor: *${price}*  •  Pagamento: ${methodLabel}`,
        ``,
        `Manter o pagamento em dia garante seus benefícios ativos e evita bloqueios. Qualquer dúvida, é só chamar aqui! ✂️`,
      ].join("\n");

      const r = await sendWhatsAppNotification(sub.barbershopId, sub.client.phone, msg);
      if (r.success) sent++; else skipped++;

      // intervalo curto para não sobrecarregar a instância do WhatsApp
      await new Promise((res) => setTimeout(res, 1000));
    }

    const result = { scanned: subs.length, sent, skipped };
    console.log(`[subscription-prebilling] Concluído: ${sent} enviados, ${skipped} pulados (de ${subs.length})`);
    await setCronHealth("subscription-prebilling", "ok", Date.now() - startedAt, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[subscription-prebilling] Fatal:", msg);
    await setCronHealth("subscription-prebilling", "error", Date.now() - startedAt, { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
