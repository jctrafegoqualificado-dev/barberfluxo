import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/evolution/client";
import { setCronHealth } from "@/lib/cron-health";

const DEFAULT_MESSAGE = `Olá, {{nome}}! 😊

Sentimos sua falta no(a) *{{empresa}}*! Faz {{dias}} dia{{plural}} que você não passa por aqui.

Que tal agendar um horário? Estamos te esperando! ✂️`;

const COOLDOWN_DAYS = 30;

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const CRON_SECRET = process.env.CRON_SECRET;
    if (!CRON_SECRET) {
      console.error("[client-retention] CRON_SECRET não configurado — endpoint bloqueado");
      return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
    }
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    const providedSecret = authHeader?.replace("Bearer ", "") || querySecret;
    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    console.log(`[client-retention] Starting at ${now.toISOString()}`);

    const shops = await prisma.barbershop.findMany({
      where: {
        retentionEnabled: true,
        active: true,
        whatsappInstance: { status: "CONNECTED" },
      },
      select: {
        id: true,
        name: true,
        retentionDays: true,
        retentionMessage: true,
        whatsappInstance: {
          select: { evolutionInstanceName: true, evolutionToken: true },
        },
      },
    });

    console.log(`[client-retention] ${shops.length} barbearias com retenção ativa`);

    let totalSent = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const shop of shops) {
      if (!shop.whatsappInstance) continue;

      const inactivityCutoff = new Date(now.getTime() - shop.retentionDays * 24 * 60 * 60 * 1000);
      const cooldownCutoff = new Date(now.getTime() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

      // Clientes desta barbearia com último agendamento DONE antes do corte de inatividade
      const inactiveClients = await prisma.appointment.findMany({
        where: {
          barbershopId: shop.id,
          status: "DONE",
          date: { lte: inactivityCutoff },
        },
        select: { clientId: true, date: true },
        orderBy: { date: "desc" },
        distinct: ["clientId"],
      });

      if (inactiveClients.length === 0) continue;

      // Exclui clientes com agendamento futuro ou recente (< retentionDays)
      const clientsWithFuture = await prisma.appointment.findMany({
        where: {
          barbershopId: shop.id,
          clientId: { in: inactiveClients.map((c) => c.clientId) },
          date: { gt: inactivityCutoff },
        },
        select: { clientId: true },
        distinct: ["clientId"],
      });
      const hasRecentSet = new Set(clientsWithFuture.map((c) => c.clientId));

      // Exclui quem já recebeu mensagem de retenção nos últimos COOLDOWN_DAYS
      const recentlySent = await prisma.clientRetention.findMany({
        where: {
          barbershopId: shop.id,
          clientId: { in: inactiveClients.map((c) => c.clientId) },
          lastSentAt: { gte: cooldownCutoff },
        },
        select: { clientId: true },
      });
      const sentRecentlySet = new Set(recentlySent.map((r) => r.clientId));

      const eligible = inactiveClients.filter(
        (c) => !hasRecentSet.has(c.clientId) && !sentRecentlySet.has(c.clientId)
      );

      if (eligible.length === 0) continue;

      // Busca dados dos clientes elegíveis
      const clientData = await prisma.user.findMany({
        where: { id: { in: eligible.map((c) => c.clientId) } },
        select: { id: true, name: true, phone: true },
      });
      const clientMap = new Map(clientData.map((c) => [c.id, c]));

      console.log(`[client-retention] ${shop.name}: ${eligible.length} clientes inativos elegíveis`);

      const template = shop.retentionMessage || DEFAULT_MESSAGE;
      const { evolutionInstanceName, evolutionToken } = shop.whatsappInstance;

      for (const { clientId, date } of eligible) {
        const client = clientMap.get(clientId);
        if (!client?.phone) { totalSkipped++; continue; }

        const diasInativos = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        const firstName = client.name.split(" ")[0];

        const message = template
          .replace(/\{\{nome\}\}/g, firstName)
          .replace(/\{\{dias\}\}/g, String(diasInativos))
          .replace(/\{\{plural\}\}/g, diasInativos === 1 ? "" : "s")
          .replace(/\{\{empresa\}\}/g, shop.name);

        const result = await sendMessage(
          evolutionInstanceName,
          client.phone,
          message,
          1200,
          evolutionToken
        );

        if ("error" in result) {
          console.error(`[client-retention] Erro ao enviar para ${client.phone}: ${result.error}`);
          totalErrors++;
        } else {
          totalSent++;
          await prisma.clientRetention.upsert({
            where: { clientId_barbershopId: { clientId, barbershopId: shop.id } },
            create: { clientId, barbershopId: shop.id, lastSentAt: now },
            update: { lastSentAt: now },
          });
        }

        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    const summary = {
      timestamp: now.toISOString(),
      shopsProcessed: shops.length,
      sent: totalSent,
      skipped: totalSkipped,
      errors: totalErrors,
    };
    console.log("[client-retention] Concluído:", summary);
    await setCronHealth("client-retention", "ok", Date.now() - startedAt, summary as Record<string, unknown>);
    return NextResponse.json(summary);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[client-retention] Fatal:", msg);
    await setCronHealth("client-retention", "error", Date.now() - startedAt, { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
