import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setCronHealth } from "@/lib/cron-health";

/**
 * WhatsApp Retention Cron
 *
 * Roda mensalmente e apaga WhatsAppMessage com mais de 12 meses.
 * O rawPayload armazena PII (nome, telefone, conteúdo) — retenção indefinida
 * viola LGPD art. 15 (término do tratamento quando finalidade atingida).
 *
 * TTL padrão: 365 dias. Ajustável via WHATSAPP_RETENTION_DAYS.
 */
export async function GET(req: NextRequest) {
  try {
    const CRON_SECRET = process.env.CRON_SECRET;
    if (!CRON_SECRET) {
      console.error("[whatsapp-retention] CRON_SECRET não configurado — endpoint bloqueado");
      return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
    }
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    const providedSecret = authHeader?.replace("Bearer ", "") || querySecret;
    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();
    const retentionDays = parseInt(process.env.WHATSAPP_RETENTION_DAYS ?? "365", 10);
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const { count } = await prisma.whatsAppMessage.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });

    console.log(`[whatsapp-retention] ${count} mensagens apagadas (anteriores a ${cutoff.toISOString()})`);
    const result = { deleted: count, cutoff: cutoff.toISOString(), retentionDays };
    await setCronHealth("whatsapp-retention", "ok", Date.now() - startedAt, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    await setCronHealth("whatsapp-retention", "error", 0, { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
