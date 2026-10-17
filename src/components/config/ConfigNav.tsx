"use client";
import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface NavSection { id: string; label: string; hint: string }

/**
 * Sub-navegação das Configurações (docs/design/Config-*.dc.html): seções da página geral e as
 * outras telas (Marca, Pagamentos, WhatsApp). No celular vira uma fileira de atalhos.
 */
export function ConfigNav({ current, sections, active, other }: {
  current: "geral" | "marca" | "pagamentos";
  sections: NavSection[];
  active?: string;
  other?: { marca?: string; pagamentos?: string; whatsapp?: string };
}) {
  const link = (s: NavSection) => (current === "geral" ? `#${s.id}` : `/painel/configuracoes#${s.id}`);
  const item = (href: string, label: string, hint: ReactNode, on: boolean) => (
    <Link key={href} href={href} aria-current={on ? "page" : undefined}
      className={cn("flex flex-col gap-0.5 px-3 py-2.5 rounded-[10px]", on ? "bg-surface border border-line shadow-[0_1px_2px_rgba(27,25,22,0.06)]" : "hover:bg-surface/60")}>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-xs text-ink-3 truncate">{hint}</span>
    </Link>
  );
  const others: [string, string, string, string | undefined][] = [
    ["marca", "/painel/configuracoes/marca", "Marca", other?.marca ?? "Logo e cores"],
    ["pagamentos", "/painel/configuracoes/pagamentos", "Pagamentos", other?.pagamentos ?? "Mercado Pago e taxas"],
    ["whatsapp", "/painel/whatsapp", "WhatsApp", other?.whatsapp ?? "Conexão, IA e lembretes"],
  ];
  return (
    <>
      <nav aria-label="Seções das configurações" className="hidden lg:flex flex-col gap-1 w-[230px] shrink-0 sticky top-6 self-start">
        <span className="px-3 pb-1 text-xs font-semibold tracking-[0.06em] uppercase text-ink-3">{current === "geral" ? "Nesta página" : "Configurações gerais"}</span>
        {sections.map((s) => item(link(s), s.label, s.hint, current === "geral" && active === s.id))}
        <span className="px-3 pt-4 pb-1 text-xs font-semibold tracking-[0.06em] uppercase text-ink-3">Outras telas</span>
        {others.map(([k, href, label, hint]) => item(href, label, hint, current === k))}
      </nav>
      <nav aria-label="Configurações" className="lg:hidden flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {[["geral", "/painel/configuracoes", "Geral"], ...others.map(([k, href, label]) => [k, href, label])].map(([k, href, label]) => (
          <Link key={k} href={href} aria-current={current === k ? "page" : undefined}
            className={cn("h-9 px-3.5 rounded-full border text-[13px] font-semibold inline-flex items-center whitespace-nowrap", current === k ? "bg-ink text-white border-ink" : "bg-surface border-control text-ink-2")}>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** Cartão de seção das Configurações, com rodapé de salvar opcional. */
export function ConfigSection({ id, title, subtitle, children, footer, aside }: {
  id?: string; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; aside?: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-t` : undefined} className="bg-surface border border-line rounded-2xl scroll-mt-6">
      <div className="px-5 md:px-6 pt-5 pb-4 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 id={id ? `${id}-t` : undefined} className="text-[17px] font-semibold">{title}</h2>
          {subtitle && <span className="text-[13px] text-ink-3">{subtitle}</span>}
        </div>
        {aside}
      </div>
      <div className="px-5 md:px-6 pb-5 flex flex-col gap-4">{children}</div>
      {footer && <div className="px-5 md:px-6 py-3.5 border-t border-line-2 bg-ground/60 rounded-b-2xl flex items-center justify-end gap-2">{footer}</div>}
    </section>
  );
}

/** Linha com título, explicação e interruptor. */
export function ToggleRow({ title, text, checked, onChange, children }: {
  title: string; text: ReactNode; checked: boolean; onChange: (v: boolean) => void; children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line-2 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <span className="text-[13px] text-ink-3">{text}</span>
        </div>
        <button type="button" role="switch" aria-checked={checked} aria-label={title} onClick={() => onChange(!checked)}
          className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", checked ? "bg-positive-strong" : "bg-bar")}>
          <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
        </button>
      </div>
      {checked && children}
    </div>
  );
}

/** Grupo de opções em pílula (radio). */
export function Pills<T extends string | number>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: [T, string][]; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={cn("h-9 px-3.5 rounded-full border text-[13px] font-semibold", value === v ? "bg-ink text-white border-ink" : "bg-surface border-control text-ink-2")}>
          {l}
        </button>
      ))}
    </div>
  );
}
