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
    const brCutoffStr = new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(cutoff);
    const [brYear, brMonth, brDay] = brCutoffStr.split("-").map(Number);
    const cutoffDate = new Date(Date.UTC(brYear, brMonth - 1, brDay, 0, 0, 0, 0));
    const cutoffHHMM = new Intl.DateTimeFormat("en", {
      timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(cutoff);

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
      if (apptDateStr < brCutoffStr) return true; // dias anteriores: marcar todos
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
