import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * mark-overdue — Cron de Vencimento de Assinaturas
 *
 * Responsabilidade única: percorrer assinaturas ACTIVE cuja nextBillingDate
 * já passou e marcá-las como OVERDUE, criando o registro de cobrança pendente.
 *
 * Executa diariamente às 08:00 BRT (11:00 UTC).
 * Não envia notificações (isso é responsabilidade do subscription-renewal).
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
        plan: { select: { price: true } },
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

      // Cria cobrança pendente se ainda não existir para este ciclo
      for (const sub of batch) {
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
      }
    }

    console.log(`[mark-overdue] Concluído: ${markedCount} OVERDUE, ${paymentCount} cobranças geradas`);
    return NextResponse.json({ ok: true, marked: markedCount, payments: paymentCount });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[mark-overdue] Erro fatal:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
