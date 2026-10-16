"use client";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

/**
 * Chip de filtro do redesign ("Hoje", "Sumidos 96", "Avulsos"…).
 * Ativo = escuro; inativo = branco com borda. Use dentro de um <div role="group">.
 */
export function Chip({
  active, count, className, children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; count?: number | string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors",
        active ? "bg-ink text-white" : "bg-surface border border-control text-ink-2 hover:bg-surface-3",
        className
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className={cn("text-xs font-semibold", active ? "text-white/70" : "text-ink-4")}>{count}</span>
      )}
    </button>
  );
}
