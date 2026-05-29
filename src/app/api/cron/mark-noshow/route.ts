import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setCronHealth } from "@/lib/cron-health";

/**
 * Mark-NoShow Cron — Multi-Tenant
 *
 * Roda diariamente às 2h BRT e marca como NO_SHOW agendamentos que:
 *  - Estão CONFIRMED ou PENDING
 *  - Pertencem a uma barbearia com autoNoShowEnabled = true
 *  - Passaram mais de autoNoShowHours horas sem fechamento
 *
 * O barbeiro tem até o número de horas configurado (padrão 24h) para
 * fechar manualmente o agendamento antes de virar NO_SHOW automaticamente.
 */
export async function GET(req: NextRequest) {
  try {
    // CVE-5: CRON_SECRET ausente bloqueia o endpoint (nunca silencia a proteção)
    const CRON_SECRET = process.env.CRON_SECRET;
    if (!CRON_SECRET) {
      console.error("[mark-noshow] CRON_SECRET não configurado — endpoint bloqueado");
      return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
    }
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    const providedSecret = authHeader?.replace("Bearer ", "") || querySecret;
    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();
    const now = new Date();

    // Busca barbearias com auto-noshow ativado
    const shops = await prisma.barbershop.findMany({
      where: { autoNoShowEnabled: true, active: true },
      select: { id: true, autoNoShowHours: true },
    });

    if (shops.length === 0) {
      return NextResponse.json({ ok: true, marked: 0, shops: 0 });
    }

    let totalMarked = 0;

    for (const shop of shops) {
      const gracePeriodMs = (shop.autoNoShowHours || 24) * 60 * 60 * 1000;
      const cutoff = new Date(now.getTime() - gracePeriodMs);

      // Data e hora do corte no fuso BRT
      const brCutoffStr = new Intl.DateTimeFormat("sv", {
        timeZone: "America/Sao_Paulo",
      }).format(cutoff);
      const [brYear, brMonth, brDay] = brCutoffStr.split("-").map(Number);
      const cutoffDate = new Date(Date.UTC(brYear, brMonth - 1, brDay, 0, 0, 0, 0));
      const cutoffHHMM = new Intl.DateTimeFormat("en", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(cutoff);

      // Candidatos desta barbearia
      const candidates = await prisma.appointment.findMany({
        where: {
          barbershopId: shop.id,
          status: { in: ["CONFIRMED", "PENDING"] },
          date: { lte: cutoffDate },
        },
        select: { id: true, date: true, startTime: true },
      });

      // Filtra: apenas os que o startTime já passou do corte
      const toMark = candidates.filter((a) => {
        const apptDateStr = a.date.toISOString().split("T")[0];
        if (apptDateStr < brCutoffStr) return true; // dias anteriores: marcar todos
        return a.startTime <= cutoffHHMM;            // mesmo dia: só se passou do corte
      });

      if (toMark.length === 0) continue;

      const { count } = await prisma.appointment.updateMany({
        where: { id: { in: toMark.map((a) => a.id) } },
        data: { status: "NO_SHOW" },
      });

      totalMarked += count;
      console.log(`[mark-noshow] Barbearia ${shop.id}: ${count} marcados (janela ${shop.autoNoShowHours}h)`);
    }

    console.log(`[mark-noshow] Total: ${totalMarked} NO_SHOW em ${shops.length} barbearias`);
    const result = { marked: totalMarked, shops: shops.length };
    await setCronHealth("mark-noshow", "ok", Date.now() - startedAt, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    await setCronHealth("mark-noshow", "error", Date.now() - startedAt, { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
