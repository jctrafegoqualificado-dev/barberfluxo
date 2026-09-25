"use client";
import Link from "next/link";
import { formatCurrency, getInitials } from "@/lib/utils";

interface RankingsSectionProps {
  topBarbers: Array<{ id: string; name: string; revenue: number; appointments: number }>;
  topClients: Array<{ id: string; name: string; totalSpent: number; visits: number }>;
  newClients: number;
  returningClients: number;
}

export function RankingsSection({ topBarbers, topClients, newClients, returningClients }: RankingsSectionProps) {
  const maxRevenue = Math.max(1, ...topBarbers.map((b) => b.revenue));
  const clientsTotal = newClients + returningClients;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section aria-labelledby="barbers-title" className="bg-white border border-line rounded-2xl px-[22px] py-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id="barbers-title" className="text-[15px] font-semibold text-ink">Profissionais</h2>
          <Link href="/painel/comissoes" className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">
            Ver comissões
          </Link>
        </div>
        {topBarbers.length === 0 ? (
          <p className="py-6 text-sm text-ink-3">Nenhum atendimento concluído no período.</p>
        ) : (
          topBarbers.map((b, i) => (
            <div key={b.id} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <span className="w-[18px] text-[13px] font-bold text-ink-4">{i + 1}</span>
                <div className="w-[30px] h-[30px] rounded-full bg-line-2 text-ink-2 text-xs font-bold flex items-center justify-center">
                  {getInitials(b.name)}
                </div>
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-ink">{b.name}</span>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink tabular-nums">{formatCurrency(b.revenue)}</p>
                  <p className="text-xs text-ink-3 tabular-nums">{b.appointments} atendimentos</p>
                </div>
              </div>
              <div className="ml-[68px] h-1 rounded-full bg-line-3" aria-hidden="true">
                <div
                  className={`h-full rounded-full ${i === 0 ? "bg-primary" : "bg-ink"}`}
                  style={{ width: `${(b.revenue / maxRevenue) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </section>

      <section aria-labelledby="clients-title" className="bg-white border border-line rounded-2xl px-[22px] py-5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h2 id="clients-title" className="text-[15px] font-semibold text-ink">Clientes que mais gastaram</h2>
          <Link href="/painel/clientes" className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">
            Ver todos
          </Link>
        </div>
        {topClients.length === 0 ? (
          <p className="py-6 text-sm text-ink-3">Nenhum cliente atendido no período.</p>
        ) : (
          topClients.map((c) => (
            <div key={c.id} className="flex items-center gap-2.5 min-h-[38px]">
              <div className="w-[30px] h-[30px] rounded-full bg-line-2 text-ink-2 text-xs font-bold flex items-center justify-center">
                {getInitials(c.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{c.name}</p>
                <p className="text-xs text-ink-3">
                  {c.visits} visita{c.visits !== 1 ? "s" : ""}
                </p>
              </div>
              <span className="text-sm font-semibold text-ink tabular-nums">{formatCurrency(c.totalSpent)}</span>
            </div>
          ))
        )}
        {clientsTotal > 0 && (
          <div className="flex flex-col gap-2 pt-3 border-t border-line-2 mt-auto">
            <div className="flex h-2 gap-0.5 rounded-full overflow-hidden" aria-hidden="true">
              <div className="bg-primary" style={{ width: `${(newClients / clientsTotal) * 100}%` }} />
              <div className="bg-ink" style={{ width: `${(returningClients / clientsTotal) * 100}%` }} />
            </div>
            <div className="flex justify-between text-[13px] text-ink-2 tabular-nums">
              <span>
                <strong className="text-ink">{newClients}</strong> clientes novos
              </span>
              <span>
                <strong className="text-ink">{returningClients}</strong> voltaram
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
