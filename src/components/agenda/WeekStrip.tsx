"use client";
import { cn } from "@/lib/utils";
import type { WeekDay } from "./types";

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Faixa da semana da agenda. Desktop: dia, número e quantos horários;
 * celular (compact): grade de 7 com um pontinho de "tem horário".
 */
export default function WeekStrip({ days, selected, today, onPick, compact }: {
  days: WeekDay[];
  selected: string;
  today: string;
  onPick: (date: string) => void;
  compact?: boolean;
}) {
  return (
    <nav aria-label="Dias da semana" className={cn(compact ? "grid grid-cols-7 gap-1" : "flex gap-1.5")}>
      {days.map((d) => {
        const on = d.date === selected;
        const dt = new Date(d.date + "T12:00:00Z");
        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onPick(d.date)}
            aria-current={on ? "date" : undefined}
            aria-label={`${DOW[dt.getUTCDay()]} ${dt.getUTCDate()}${d.isOpen ? `, ${d.count} horários` : ", fechado"}${d.date === today ? ", hoje" : ""}`}
            className={cn(
              "flex flex-col items-center justify-center gap-px rounded-[10px] border transition-colors",
              compact ? "h-[60px]" : "w-[76px] h-[58px]",
              on ? "bg-ink border-ink text-white" : "bg-surface border-line hover:border-control",
              !on && (d.isOpen ? "text-ink" : "text-ink-4")
            )}
          >
            <span className={cn("font-semibold uppercase tracking-[0.04em] opacity-80", compact ? "text-[10px]" : "text-[11px]")}>
              {DOW[dt.getUTCDay()]}
            </span>
            <span className={cn("font-bold leading-tight", compact ? "text-base" : "text-[17px]")}>{dt.getUTCDate()}</span>
            {compact ? (
              <span
                className={cn("w-[5px] h-[5px] rounded-full", on ? "bg-primary" : d.isOpen && d.count > 0 ? "bg-[#B9B0A1]" : "bg-transparent")}
                aria-hidden
              />
            ) : (
              <span className="text-[11px] opacity-80">{d.isOpen ? `${d.count} hor.` : "fechado"}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
