import { cn, STATUS_LABELS } from "@/lib/utils";
import { ReactNode } from "react";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

// Cores de estado do redesign (docs/design/LEIA-ME-HANDOFF.md)
const TONES: Record<Tone, string> = {
  success: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-[#E8EEF7] text-[#1F4E8C]",
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-primary/10 text-primary",
};

const STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  CONFIRMED: "info",
  DONE: "success",
  CANCELLED: "neutral",
  NO_SHOW: "danger",
  ACTIVE: "success",
  OVERDUE: "danger",
  PAUSED: "warning",
};

/** Selo de status de agendamento/assinatura (PENDING, DONE, OVERDUE…). */
export function Badge({ status, className }: { status: string; className?: string }) {
  return <Pill tone={STATUS_TONE[status] ?? "neutral"} className={className}>{STATUS_LABELS[status] || status}</Pill>;
}

/** Selo com tom livre — ex.: <Pill tone="success" dot>Pago</Pill> */
export function Pill({ tone = "neutral", dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap", TONES[tone], className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
