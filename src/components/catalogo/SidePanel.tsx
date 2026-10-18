"use client";
import { ReactNode, useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const WIDE = "(min-width: 1280px)";

/** true a partir de 1280px: o editor fica ao lado da lista; abaixo disso abre por cima. */
export function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

/**
 * Editor do Catálogo (Profissionais, Serviços, Produtos): coluna fixa ao lado da lista
 * no computador; folha por cima no celular/tablet.
 */
export function SidePanel({ open, wide, onClose, children, footer, label }: {
  open: boolean;
  wide: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  label: string;
}) {
  useEffect(() => {
    if (!open || wide) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, wide, onClose]);

  if (!open) return null;
  const body = (
    <>
      <div className="flex-1 overflow-y-auto">{children}</div>
      {footer && <div className="border-t border-line-2 px-5 py-3.5 bg-surface">{footer}</div>}
    </>
  );
  if (wide) {
    return (
      <aside aria-label={label} className="w-[400px] shrink-0 sticky top-6 max-h-[calc(100vh-3rem)] bg-surface border border-line rounded-2xl overflow-hidden flex flex-col">
        {body}
      </aside>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={label}
        className={cn("relative bg-surface w-full sm:max-w-lg sm:mx-4 rounded-t-[18px] sm:rounded-[18px] max-h-[92vh] flex flex-col overflow-hidden")}>
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 z-10 w-9 h-9 rounded-lg text-ink-3 hover:bg-surface-2 flex items-center justify-center">
          <X className="w-5 h-5" aria-hidden />
        </button>
        {body}
      </div>
    </div>
  );
}

/** Bloco com título dentro do editor. */
export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="px-5 py-4 border-t border-line-2 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Interruptor acessível (role=switch). */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-40", checked ? "bg-positive-strong" : "bg-bar")}>
      <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}

/** Segmentado (Todos / Ativos / …). */
export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: [T, string][]; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex p-1 rounded-[10px] bg-surface-3 overflow-x-auto max-w-full">
      {options.map(([k, l]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}
          className={cn("h-8 px-3 rounded-lg text-[13px] font-semibold whitespace-nowrap", value === k ? "bg-surface text-ink shadow-sm" : "text-ink-2")}>
          {l}
        </button>
      ))}
    </div>
  );
}

export const fieldCls =
  "w-full h-11 rounded-[10px] border border-control bg-surface px-3.5 text-sm text-ink placeholder:text-ink-4 " +
  "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-surface-3 disabled:text-ink-3";

/** Campo com rótulo e prefixo/sufixo opcionais ("R$", "min", "%"). */
export function Field({ label, prefix, suffix, hint, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string; prefix?: string; suffix?: string; hint?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5 min-w-0", className)}>
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      {prefix || suffix ? (
        <span className="flex items-center h-11 rounded-[10px] border border-control bg-surface px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          {prefix && <span className="text-sm text-ink-3 mr-1.5">{prefix}</span>}
          <input {...props} className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
          {suffix && <span className="text-sm text-ink-3 ml-1.5">{suffix}</span>}
        </span>
      ) : (
        <input {...props} className={fieldCls} />
      )}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  );
}
