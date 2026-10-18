"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  ["geral", "/painel/whatsapp", "Visão geral"],
  ["ia", "/painel/configuracoes/assistente-ia", "Atendente de IA"],
  ["lembretes", "/painel/configuracoes/lembretes", "Lembretes"],
] as const;

/** Cabeçalho comum das telas do WhatsApp (docs/design/WhatsApp-desktop.dc.html). */
export default function WhatsAppTabs({ current, subtitle }: { current: (typeof TABS)[number][0]; subtitle?: string }) {
  return (
    <header className="flex items-end justify-between gap-3 flex-wrap">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">WhatsApp</h1>
        <span className="text-sm text-ink-3">{subtitle ?? "Conexão, atendente de IA e mensagens automáticas"}</span>
      </div>
      <nav aria-label="Seções do WhatsApp" className="flex p-1 rounded-[10px] bg-track overflow-x-auto max-w-full">
        {TABS.map(([k, href, label]) => (
          <Link key={k} href={href} aria-current={current === k ? "page" : undefined}
            className={cn("h-[34px] px-3.5 rounded-[7px] text-[13px] font-semibold inline-flex items-center whitespace-nowrap",
              current === k ? "bg-surface text-ink shadow-[0_1px_2px_rgba(27,25,22,0.12)]" : "text-ink-2")}>
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
