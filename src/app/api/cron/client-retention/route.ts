import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/evolution/client";
import { setCronHealth } from "@/lib/cron-health";
import { getEntitlements } from "@/lib/entitlements";

const DEFAULT_MESSAGE = `Olá, {{nome}}! 😊

Sentimos sua falta no(a) *{{empresa}}*! Faz {{dias}} dia{{plural}} que você não passa por aqui.

Que tal agendar um horário? Estamos te esperando! ✂️`;

const COOLDOWN_DAYS = 30;

type EligibleClient = {
  clientId: string;
  date: Date;
  name: string;
  phone: string | null;
};

type ShopEligible = {
  shop: {
    id: string;
    name: string;
    retentionMessage: string | null;
    whatsappInstance: { evolutionInstanceName: string; evolutionToken: string | null } | null;
  };
  eligible: EligibleClient[];
};

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
    const cooldownCutoff = new Date(now.getTime() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
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
        saasPlan: true,
        saasStatus: true,
        saasExpiresAt: true,
        trialEndsAt: true,
        whatsappInstance: {
          select: { evolutionInstanceName: true, evolutionToken: true },
        },
      },
    });

    console.log(`[client-retention] ${shops.length} barbearias com retenção ativa`);

    // Phase 1: coleta clientes elegíveis de todas as barbearias em paralelo
    const allShopEligible: ShopEligible[] = [];

    await Promise.all(shops.map(async (shop) => {
      if (!shop.whatsappInstance) return;
      // Paywall: não envia retenção para barbearia sem plano ativo.
      if (!getEntitlements(shop).hasAccess) return;

      const inactivityCutoff = new Date(now.getTime() - shop.retentionDays * 24 * 60 * 60 * 1000);

      const inactiveClients = await prisma.appointment.findMany({
        where: { barbershopId: shop.id, status: "DONE", date: { lte: inactivityCutoff } },
        select: { clientId: true, date: true },
        orderBy: { date: "desc" },
        distinct: ["clientId"],
      });

      if (inactiveClients.length === 0) return;

      const clientIds = inactiveClients.map((c) => c.clientId);

      const [clientsWithFuture, recentlySent, clientData] = await Promise.all([
        prisma.appointment.findMany({
          where: { barbershopId: shop.id, clientId: { in: clientIds }, date: { gt: inactivityCutoff } },
          select: { clientId: true },
          distinct: ["clientId"],
        }),
        prisma.clientRetention.findMany({
          where: { barbershopId: shop.id, clientId: { in: clientIds }, lastSentAt: { gte: cooldownCutoff } },
          select: { clientId: true },
        }),
        prisma.user.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true, phone: true },
        }),
      ]);

      const hasRecentSet = new Set(clientsWithFuture.map((c) => c.clientId));
      const sentRecentlySet = new Set(recentlySent.map((r) => r.clientId));
      const clientMap = new Map(clientData.map((c) => [c.id, c]));

      const eligible: EligibleClient[] = inactiveClients.flatMap((c) => {
        if (hasRecentSet.has(c.clientId) || sentRecentlySet.has(c.clientId)) return [];
        const client = clientMap.get(c.clientId);
        if (!client) return [];
        return [{ clientId: c.clientId, date: c.date, name: client.name, phone: client.phone }];
      });

      if (eligible.length > 0) {
        allShopEligible.push({ shop, eligible });
        console.log(`[client-retention] ${shop.name}: ${eligible.length} clientes inativos elegíveis`);
      }
    }));

    let totalSent = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Phase 2: envia mensagens sequencialmente (rate limiting do WhatsApp)
    for (const { shop, eligible } of allShopEligible) {
      const template = shop.retentionMessage || DEFAULT_MESSAGE;
      const { evolutionInstanceName, evolutionToken } = shop.whatsappInstance!;

      for (const { clientId, date, name, phone } of eligible) {
        if (!phone) { totalSkipped++; continue; }

        const diasInativos = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        const firstName = name.split(" ")[0];

        const message = template
          .replace(/\{\{nome\}\}/g, firstName)
          .replace(/\{\{dias\}\}/g, String(diasInativos))
          .replace(/\{\{plural\}\}/g, diasInativos === 1 ? "" : "s")
          .replace(/\{\{empresa\}\}/g, shop.name);

        const result = await sendMessage(
          evolutionInstanceName,
          phone,
          message,
          1200,
          evolutionToken ?? undefined
        );

        if ("error" in result) {
          console.error(`[client-retention] Erro ao enviar para ${phone}: ${result.error}`);
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
