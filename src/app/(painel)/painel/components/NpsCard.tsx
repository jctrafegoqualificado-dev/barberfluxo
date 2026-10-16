"use client";
import Link from "next/link";
import type { DashboardData } from "./dashboard-types";

const LEVEL: Record<string, { label: string; className: string }> = {
  EXCELENTE: { label: "Excelente", className: "bg-positive-soft text-positive" },
  "MUITO BOM": { label: "Muito bom", className: "bg-positive-soft text-positive" },
  BOM: { label: "Bom", className: "bg-warning-soft text-warning" },
  "CRÍTICO": { label: "Crítico", className: "bg-danger-soft text-danger" },
};

export function NpsCard({ nps }: { nps: DashboardData["nps"] }) {
  const level = LEVEL[nps.level];
  const total = nps.promoters + nps.passives + nps.detractors;

  return (
    <section aria-labelledby="nps-title" className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h2 id="nps-title" className="text-[15px] font-semibold text-ink">Satisfação dos clientes</h2>
        {level && (
          <span className={`h-6 px-2.5 rounded-full text-xs font-semibold flex items-center ${level.className}`}>{level.label}</span>
        )}
      </div>

      {nps.score === null ? (
        <p className="text-sm text-ink-3">
          Ainda sem avaliações no período. Depois de cada atendimento o cliente recebe a pesquisa pelo WhatsApp.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="font-display text-[40px] leading-none font-bold tracking-tight text-ink tabular-nums">{nps.score}</span>
            <span className="text-[13px] text-ink-2">
              NPS · nota média {nps.average.toLocaleString("pt-BR")} · {nps.total} avaliações
            </span>
          </div>
          {total > 0 && (
            <div className="flex h-2 gap-0.5 rounded-full overflow-hidden" aria-hidden="true">
              <div className="bg-positive-strong" style={{ width: `${(nps.promoters / total) * 100}%` }} />
              <div className="bg-bar-soft" style={{ width: `${(nps.passives / total) * 100}%` }} />
              <div className="bg-danger-strong" style={{ width: `${(nps.detractors / total) * 100}%` }} />
            </div>
          )}
          <div className="flex justify-between text-xs text-ink-2 tabular-nums">
            <span><strong className="text-ink">{nps.promoters}</strong> promotores</span>
            <span><strong className="text-ink">{nps.passives}</strong> neutros</span>
            <span><strong className="text-ink">{nps.detractors}</strong> detratores</span>
          </div>
          <Link href="/painel/fidelidade" className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">
            Ver fidelidade e avaliações
          </Link>
        </>
      )}
    </section>
  );
}
