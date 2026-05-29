import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { getAllCronHealth } from "@/lib/cron-health";

const JOB_NAMES = [
  "reminders",
  "mark-noshow",
  "mark-overdue",
  "subscription-renewal",
  "check-saas-expiry",
  "maintenance",
  "whatsapp-retention",
];

// Schedules para calcular se o job está atrasado (em horas)
const JOB_SCHEDULES: Record<string, { label: string; maxAgeHours: number }> = {
  "reminders":             { label: "Lembretes",          maxAgeHours: 25 },
  "mark-noshow":           { label: "Marcar No-Show",     maxAgeHours: 25 },
  "mark-overdue":          { label: "Marcar Inadimplente",maxAgeHours: 25 },
  "subscription-renewal":  { label: "Renovação Assinatura",maxAgeHours: 25 },
  "check-saas-expiry":     { label: "Vencimento SaaS",    maxAgeHours: 25 },
  "maintenance":           { label: "Manutenção Geral",   maxAgeHours: 25 },
  "whatsapp-retention":    { label: "Retenção WhatsApp",  maxAgeHours: 24 * 33 }, // mensal
};

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const health = await getAllCronHealth(JOB_NAMES);
    const now = Date.now();

    const jobs = JOB_NAMES.map((name) => {
      const entry = health[name];
      const schedule = JOB_SCHEDULES[name];
      let statusLabel: "ok" | "error" | "stale" | "never" = "never";

      if (!entry) {
        statusLabel = "never";
      } else if (entry.status === "error") {
        statusLabel = "error";
      } else {
        const ageHours = (now - new Date(entry.lastRun).getTime()) / (1000 * 60 * 60);
        statusLabel = ageHours > schedule.maxAgeHours ? "stale" : "ok";
      }

      return {
        name,
        label: schedule.label,
        status: statusLabel,
        lastRun: entry?.lastRun ?? null,
        durationMs: entry?.durationMs ?? null,
        result: entry?.result ?? null,
      };
    });

    return NextResponse.json({ jobs });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
