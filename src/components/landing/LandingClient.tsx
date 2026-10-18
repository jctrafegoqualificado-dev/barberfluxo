"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Partes interativas da página de vendas (o resto é montado no servidor). */

export function MobileMenu({ links }: { links: [string, string][] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Fechar menu" : "Abrir menu"}
        className="w-11 h-11 rounded-[10px] border border-line bg-surface flex items-center justify-center">
        {open ? <X className="w-5 h-5" aria-hidden /> : <Menu className="w-5 h-5" aria-hidden />}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full bg-ground border-b border-line px-4 py-3 flex flex-col shadow-lg">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="h-12 flex items-center text-base font-semibold border-b border-line-2 last:border-b-0">{label}</a>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-3">
            <Link href="/login" className="h-12 rounded-xl border border-control bg-surface font-semibold flex items-center justify-center">Entrar</Link>
            <a href="#planos" onClick={() => setOpen(false)} className="h-12 rounded-xl bg-primary text-white font-semibold flex items-center justify-center">Começar agora</a>
          </div>
        </div>
      )}
    </div>
  );
}

export interface LandingPlan {
  key: "PRO" | "ELITE"; name: string; desc: string; monthly: number; annualMonthly: number | null;
  includedBarbers: number; extraMonthly: number; extraAnnualMonthly: number | null;
  items: string[]; popular: boolean; cta: string;
}
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Planos({ plans }: { plans: LandingPlan[] }) {
  const [annual, setAnnual] = useState(false);
  const hasAnnual = plans.some((p) => p.annualMonthly != null);
  return (
    <div className="flex flex-col items-center gap-8">
      {hasAnnual && (
        <div role="group" aria-label="Forma de cobrança" className="flex p-1 gap-0.5 rounded-xl bg-track">
          {([[false, "Mensal"], [true, "Anual · economize 10%"]] as [boolean, string][]).map(([v, l]) => (
            <button key={l} type="button" aria-pressed={annual === v} onClick={() => setAnnual(v)}
              className={cn("h-10 px-4 rounded-[9px] text-sm font-semibold", annual === v ? "bg-surface text-ink shadow-[0_1px_2px_rgba(27,25,22,0.12)]" : "text-ink-2")}>{l}</button>
          ))}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2 w-full max-w-[920px]">
        {plans.map((p) => {
          const showAnnual = annual && p.annualMonthly != null;
          const price = showAnnual ? p.annualMonthly! : p.monthly;
          return (
            <div key={p.key} className={cn("relative flex flex-col gap-5 rounded-[20px] p-7 border",
              p.popular ? "bg-[#1B1916] text-white border-[#1B1916]" : "bg-surface border-line")}>
              {p.popular && <span className="absolute -top-3 left-7 h-6 px-3 rounded-full bg-primary text-white text-xs font-bold flex items-center">Mais escolhido</span>}
              <div className="flex flex-col gap-1.5">
                <span className="font-display text-[22px] font-bold">{p.name}</span>
                <span className={cn("text-sm leading-relaxed", p.popular ? "text-[#C9C2B6]" : "text-ink-2")}>{p.desc}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-display text-[44px] font-bold tracking-[-0.02em] leading-none">{brl(price)}</span>
                <span className={cn("text-sm", p.popular ? "text-[#C9C2B6]" : "text-ink-3")}>
                  {showAnnual ? `por mês · ${brl(Math.round(price * 12 * 100) / 100)} cobrado uma vez por ano` : "por mês"}
                </span>
              </div>
              <span className={cn("text-sm font-semibold -mt-2", p.popular ? "text-primary" : "text-ink-2")}>
                {p.extraMonthly > 0
                  ? `${p.includedBarbers} barbeiros inclusos. A partir do ${p.includedBarbers + 1}º: + ${brl(showAnnual ? p.extraAnnualMonthly ?? p.extraMonthly : p.extraMonthly)} por barbeiro/mês`
                  : "Sem valor extra por barbeiro"}
              </span>
              <Link href={`/cadastro?plano=${p.key}`}
                className={cn("h-[52px] rounded-xl font-semibold text-base flex items-center justify-center", p.popular ? "bg-primary text-white" : "bg-ink text-white")}>
                {p.cta}
              </Link>
              <ul className={cn("flex flex-col gap-2.5 pt-5 border-t", p.popular ? "border-[#3A352F]" : "border-line")}>
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-2.5 text-[15px]">
                    <Check className={cn("w-[18px] h-[18px] mt-0.5 shrink-0", p.popular ? "text-primary" : "text-positive")} strokeWidth={2.6} aria-hidden />{it}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Faq({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="flex flex-col">
      {items.map(([q, a], i) => (
        <div key={q} className="border-b border-line">
          <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}
            className="w-full min-h-[64px] py-4 flex items-center justify-between gap-4 text-left text-[17px] font-semibold">
            {q}<span className="text-2xl font-normal text-ink-3 shrink-0" aria-hidden>{open === i ? "−" : "+"}</span>
          </button>
          {open === i && <p className="pb-5 text-[15px] leading-relaxed text-ink-2 max-w-[680px]">{a}</p>}
        </div>
      ))}
    </div>
  );
}
