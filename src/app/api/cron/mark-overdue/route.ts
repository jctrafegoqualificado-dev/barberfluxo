import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setCronHealth } from "@/lib/cron-health";
import { sendWhatsAppNotification } from "@/lib/notifications";

/**
 * mark-overdue — Cron de Vencimento de Assinaturas
 *
 * Responsabilidade única: percorrer assinaturas ACTIVE cuja nextBillingDate
 * já passou e marcá-las como OVERDUE, criando o registro de cobrança pendente.
 *
 * Executa diariamente às 08:00 BRT (11:00 UTC).
 * Ao marcar OVERDUE, avisa o cliente via WhatsApp (número da própria barbearia)
 * que a assinatura ficou em aberto. O subscription-renewal cuida do aviso PRÉ-vencimento.
 *
 * Proteção: CRON_SECRET obrigatório (Authorization: Bearer <secret>).
 */
export async function GET(req: NextRequest) {
  // ── Autenticação do cron ─────────────────────────────────────────────────
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    console.error("[mark-overdue] CRON_SECRET não configurado — endpoint bloqueado");
    return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
  }

  const authHeader  = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const provided    = authHeader?.replace("Bearer ", "").trim() ?? querySecret;

  if (provided !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Lógica principal ────────────────────────────────────────────────────
  const startedAt = Date.now();
  const now = new Date();

  try {
    // Busca todas as ACTIVE que já passaram da data de vencimento
    const overdueList = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        nextBillingDate: { lt: now },
      },
      select: {
        id: true,
        nextBillingDate: true,
        barbershopId: true,
        client: { select: { name: true, phone: true } },
        plan: { select: { name: true, price: true } },
        barbershop: { select: { name: true } },
        payments: {
          where: { status: "PENDING" },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (overdueList.length === 0) {
      return NextResponse.json({ ok: true, marked: 0, payments: 0 });
    }

    let markedCount   = 0;
    let paymentCount  = 0;
    let notifiedCount = 0;

    // Processa em lotes para não travar o banco com um único UPDATE grande
    const BATCH = 50;
    for (let i = 0; i < overdueList.length; i += BATCH) {
      const batch = overdueList.slice(i, i + BATCH);
      const ids   = batch.map((s) => s.id);

      await prisma.subscription.updateMany({
        where: { id: { in: ids }, status: "ACTIVE" }, // re-checa status p/ race condition
        data:  { status: "OVERDUE" },
      });
      markedCount += batch.length;

      for (const sub of batch) {
        // Cria cobrança pendente se ainda não existir para este ciclo
        if (sub.payments.length === 0) {
          await prisma.payment.create({
            data: {
              amount:         sub.plan.price,
              method:         "PIX",
              status:         "PENDING",
              subscriptionId: sub.id,
              barbershopId:   sub.barbershopId,
            },
          });
          paymentCount++;
        }

        // Avisa o cliente via WhatsApp da barbearia que a assinatura ficou em atraso.
        // Falha de envio não interrompe o cron (sendWhatsAppNotification nunca lança).
        if (sub.client?.phone) {
          const firstName = sub.client.name.split(" ")[0];
          const price = sub.plan.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          const msg = [
            `Olá, ${firstName}! 👋`,
            ``,
            `Sua assinatura *${sub.plan.name}* no(a) *${sub.barbershop.name}* está *em atraso*.`,
            ``,
            `Valor: *${price}*`,
            ``,
            `Regularize o pagamento com a barbearia para manter seus benefícios ativos. ✂️`,
          ].join("\n");
          const r = await sendWhatsAppNotification(sub.barbershopId, sub.client.phone, msg);
          if (r.success) notifiedCount++;
          // pequeno intervalo para não sobrecarregar a instância do WhatsApp
          await new Promise((res) => setTimeout(res, 1000));
        }
      }
    }

    console.log(`[mark-overdue] Concluído: ${markedCount} OVERDUE, ${paymentCount} cobranças, ${notifiedCount} avisos`);
    const result = { marked: markedCount, payments: paymentCount, notified: notifiedCount };
    await setCronHealth("mark-overdue", "ok", Date.now() - startedAt, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[mark-overdue] Erro fatal:", msg);
    await setCronHealth("mark-overdue", "error", Date.now() - startedAt, { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
