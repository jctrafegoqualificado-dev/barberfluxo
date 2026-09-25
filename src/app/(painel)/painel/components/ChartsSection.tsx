"use client";
import { formatCurrency } from "@/lib/utils";

interface ChartsSectionProps {
  dailyRevenue: Array<{ date: string; revenue: number }>;
  appointmentStatus: { DONE: number; PENDING: number; CANCELLED: number; NO_SHOW: number };
  projecaoMes: number;
  showProjection: boolean;
  periodLabel: string;
}

function roundedTop(max: number) {
  if (max <= 0) return 1000;
  const step = max > 5000 ? 5000 : max > 1000 ? 1000 : 100;
  return Math.ceil(max / step) * step;
}

function compact(value: number) {
  return value >= 1000 ? `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(value);
}

export function ChartsSection({ dailyRevenue, appointmentStatus, projecaoMes, showProjection, periodLabel }: ChartsSectionProps) {
  const top = roundedTop(Math.max(0, ...dailyRevenue.map((d) => d.revenue)));
  const lastIndexWithData = dailyRevenue.reduce((acc, d, i) => (d.revenue > 0 ? i : acc), -1);
  const showEvery = dailyRevenue.length > 16 ? Math.ceil(dailyRevenue.length / 16) : 1;

  const statusTotal =
    appointmentStatus.DONE + appointmentStatus.PENDING + appointmentStatus.CANCELLED + appointmentStatus.NO_SHOW;
  const statuses = [
    { label: "Concluídos", value: appointmentStatus.DONE, color: "bg-ink" },
    { label: "Pendentes", value: appointmentStatus.PENDING, color: "bg-bar-soft" },
    { label: "Cancelados", value: appointmentStatus.CANCELLED, color: "bg-ink-4" },
    { label: "Faltas", value: appointmentStatus.NO_SHOW, color: "bg-danger-strong" },
  ];

  return (
    <section aria-labelledby="revenue-title" className="bg-white border border-line rounded-2xl px-6 py-5 flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="revenue-title" className="text-[15px] font-semibold text-ink">Faturamento por dia</h2>
          <p className="text-[13px] text-ink-3">{periodLabel}</p>
        </div>
        {showProjection && (
          <div className="text-right">
            <p className="text-xs text-ink-3">Projeção do mês</p>
            <p className="font-display text-[22px] font-bold text-ink tabular-nums">{formatCurrency(projecaoMes)}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <div className="w-11 h-44 flex flex-col justify-between text-right text-[11px] text-ink-4 shrink-0" aria-hidden="true">
          <span>{compact(top)}</span>
          <span>{compact(top / 2)}</span>
          <span>0</span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="relative h-44 flex items-end gap-[3px] sm:gap-1.5 border-b border-bar-soft">
            <div className="absolute inset-x-0 top-1.5 border-t border-dashed border-line-2" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line-2" />
            {dailyRevenue.map((d, i) => (
              <div
                key={d.date}
                title={`${d.date} · ${formatCurrency(d.revenue)}`}
                className={`relative flex-1 rounded-t-[3px] ${
                  i === lastIndexWithData ? "bg-primary" : d.revenue > 0 ? "bg-bar" : "bg-line-2"
                }`}
                style={{ height: d.revenue > 0 ? `${(d.revenue / top) * 100}%` : "3px" }}
              />
            ))}
          </div>
          <div className="flex gap-[3px] sm:gap-1.5">
            {dailyRevenue.map((d, i) => (
              <span
                key={d.date}
                className={`flex-1 text-center text-[10px] sm:text-[11px] ${
                  i === lastIndexWithData ? "font-bold text-ink" : "text-ink-4"
                }`}
              >
                {i % showEvery === 0 ? d.date.split("/")[0] : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-4 border-t border-line-2">
        <div className="flex justify-between text-[13px]">
          <span className="font-semibold text-ink">Status dos atendimentos no período</span>
          <span className="text-ink-3 tabular-nums">{statusTotal} no total</span>
        </div>
        {statusTotal > 0 && (
          <div className="flex h-2.5 gap-0.5 rounded-full overflow-hidden" aria-hidden="true">
            {statuses.map((s) => (
              <div key={s.label} className={s.color} style={{ width: `${(s.value / statusTotal) * 100}%` }} />
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
          {statuses.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-sm ${s.color}`} />
              {s.label} <strong className="text-ink tabular-nums">{s.value}</strong>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
