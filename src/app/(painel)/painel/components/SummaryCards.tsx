"use client";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface SummaryCardsProps {
  mrr: number;
  activeSubscriptions: number;
  newSubscriptions: number;
  occupation: { pct: number; usedMinutes: number; availableMinutes: number };
  comissoes: { totalPago: number; totalVales: number; barbeirosPagos: number };
}

export function SummaryCards({ mrr, activeSubscriptions, newSubscriptions, occupation, comissoes }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Link href="/painel/assinaturas" className="bg-white border border-line rounded-[14px] p-[18px] flex flex-col gap-2 hover:border-bar-soft">
        <span className="text-[13px] font-medium text-ink-2">Assinaturas (recorrência)</span>
        <span className="font-display text-2xl font-bold text-ink tabular-nums">
          {formatCurrency(mrr)}
          <span className="text-sm font-semibold text-ink-3">/mês</span>
        </span>
        <span className="text-[13px] text-ink-2">
          {activeSubscriptions} assinante{activeSubscriptions !== 1 ? "s" : ""}
          {newSubscriptions > 0 && <span className="font-semibold text-positive"> · +{newSubscriptions} no período</span>}
        </span>
      </Link>

      <Link href="/painel/ocupacao" className="bg-white border border-line rounded-[14px] p-[18px] flex flex-col gap-2 hover:border-bar-soft">
        <span className="text-[13px] font-medium text-ink-2">Ocupação das cadeiras</span>
        <span className="font-display text-2xl font-bold text-ink tabular-nums">{occupation.pct}%</span>
        <div className="h-2 rounded-full bg-line-2 overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-ink" style={{ width: `${occupation.pct}%` }} />
        </div>
        <span className="text-[13px] text-ink-2 tabular-nums">
          {Math.round(occupation.usedMinutes / 60)} h usadas de {Math.round(occupation.availableMinutes / 60)} h
        </span>
      </Link>

      <Link href="/painel/comissoes" className="bg-white border border-line rounded-[14px] p-[18px] flex flex-col gap-2 hover:border-bar-soft">
        <span className="text-[13px] font-medium text-ink-2">Comissões do mês</span>
        <span className="font-display text-2xl font-bold text-ink tabular-nums">{formatCurrency(comissoes.totalPago)}</span>
        <span className="text-[13px] text-ink-2">
          pagas a {comissoes.barbeirosPagos} profissiona{comissoes.barbeirosPagos === 1 ? "l" : "is"}
          {comissoes.totalVales > 0 && (
            <span className="font-semibold text-danger"> · {formatCurrency(comissoes.totalVales)} em vales</span>
          )}
        </span>
      </Link>
    </div>
  );
}
