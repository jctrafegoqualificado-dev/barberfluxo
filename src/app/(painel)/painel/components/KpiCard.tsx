"use client";
import { formatCurrency } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  change: number | null;
  prevLabel?: string;
  isCurrency?: boolean;
}

export function KpiCard({ title, value, change, prevLabel, isCurrency }: KpiCardProps) {
  const display =
    typeof value === "number" ? (isCurrency ? formatCurrency(value) : value.toLocaleString("pt-BR")) : value;
  const up = change !== null && change >= 0;

  return (
    <div className="bg-white border border-line rounded-[14px] p-[18px] flex flex-col gap-2 min-w-0">
      <span className="text-[13px] font-medium text-ink-2">{title}</span>
      <span className="font-display text-[26px] leading-tight font-bold tracking-tight text-ink tabular-nums truncate">
        {display}
      </span>
      <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
        {change === null ? (
          <span className="text-ink-3">sem período anterior</span>
        ) : (
          <span className={`font-bold ${up ? "text-positive" : "text-danger"}`}>
            {up ? "↑" : "↓"} {Math.abs(change)}%
          </span>
        )}
        {prevLabel && <span className="text-ink-3 truncate">{prevLabel}</span>}
      </div>
    </div>
  );
}
