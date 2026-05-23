import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CRON_SECRET = process.env.CRON_SECRET || "";

// Roda diariamente às 23h e marca como NO_SHOW agendamentos que passaram
// há mais de 2h e continuam CONFIRMED ou PENDING (cliente não compareceu).
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    const providedSecret = authHeader?.replace("Bearer ", "") || querySecret;

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Corte: agendamentos com startTime <= (agora - 2h) ainda PENDING/CONFIRMED
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const cutoffDate = new Date(cutoff);
    cutoffDate.setHours(0, 0, 0, 0);

    const cutoffHHMM = `${String(cutoff.getHours()).padStart(2, "0")}:${String(cutoff.getMinutes()).padStart(2, "0")}`;

    // Busca todos os agendamentos passados ainda ativos
    const candidates = await prisma.appointment.findMany({
      where: {
        status: { in: ["CONFIRMED", "PENDING"] },
        date: { lte: cutoffDate },
      },
      select: { id: true, date: true, startTime: true },
    });

    // Filtra: apenas os que o startTime já passou do corte
    const toMark = candidates.filter((a) => {
      const apptDateStr = a.date.toISOString().split("T")[0];
      const cutoffDateStr = cutoff.toISOString().split("T")[0];
      if (apptDateStr < cutoffDateStr) return true; // dias anteriores: marcar todos
      return a.startTime <= cutoffHHMM; // mesmo dia: só se já passou do corte
    });

    if (toMark.length === 0) {
      return NextResponse.json({ ok: true, marked: 0 });
    }

    const { count } = await prisma.appointment.updateMany({
      where: { id: { in: toMark.map((a) => a.id) } },
      data: { status: "NO_SHOW" },
    });

    console.log(`[mark-noshow] Marcados ${count} agendamentos como NO_SHOW`);
    return NextResponse.json({ ok: true, marked: count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
