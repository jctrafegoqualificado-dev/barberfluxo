"use client";
import Link from "next/link";
import { MessageCircle, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Forecast, TodayAppointment } from "./dashboard-types";
import { firstName, whatsappLink } from "./dashboard-types";

interface ForecastCardProps {
  forecast: Forecast;
  appointments: TodayAppointment[];
}

const pct = (value: number, total: number) => (total > 0 ? `${Math.min(100, (value / total) * 100)}%` : "0%");

export function ForecastCard({ forecast, appointments }: ForecastCardProps) {
  const { done, confirmed, unconfirmed, noShow, best, realistic, dailyGoal, byHour, nowHour } = forecast;
  const scale = Math.max(dailyGoal ?? 0, best, 1);
  const goalPct = dailyGoal ? Math.round((best / dailyGoal) * 100) : null;
  const missing = dailyGoal ? Math.max(0, dailyGoal - best) : 0;

  const hourMax = Math.max(1, ...byHour.map((h) => h.done + h.confirmed + h.unconfirmed));
  const peak = byHour.reduce(
    (acc, h) => {
      const total = h.done + h.confirmed + h.unconfirmed;
      return total > acc.total ? { hour: h.hour, total } : acc;
    },
    { hour: -1, total: 0 }
  );

  // Primeiro cliente sem confirmação com telefone — atalho para pedir confirmação
  const firstUnconfirmed = appointments.find((a) => a.status === "PENDING" && a.client?.phone);
  const confirmLink = firstUnconfirmed
    ? whatsappLink(
        firstUnconfirmed.client.phone,
        `Olá, ${firstName(firstUnconfirmed.client.name)}! Confirmando seu horário hoje às ${firstUnconfirmed.startTime}. Podemos contar com você?`
      )
    : null;

  const rows = [
    { label: "Já faturado", detail: `${done.count} atendimento${done.count !== 1 ? "s" : ""}`, value: done.value, swatch: "bg-ink" },
    { label: "Confirmados", detail: `${confirmed.count} horário${confirmed.count !== 1 ? "s" : ""}`, value: confirmed.value, swatch: "bg-primary" },
    { label: "Sem confirmação", detail: `${unconfirmed.count} horário${unconfirmed.count !== 1 ? "s" : ""}`, value: unconfirmed.value, swatch: "bg-primary/40" },
  ];

  return (
    <section aria-labelledby="forecast-title" className="bg-white border border-line rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-line-2">
        <div>
          <h2 id="forecast-title" className="text-[15px] font-semibold text-ink">Previsão de faturamento de hoje</h2>
          <p className="text-[13px] text-ink-3">Calculada com os agendamentos do dia</p>
        </div>
        {dailyGoal ? (
          <span className="flex items-center gap-2 h-8 px-3 rounded-full bg-ground text-[13px] text-ink-2">
            <Target className="w-4 h-4" />
            Meta do dia <strong className="text-ink">{formatCurrency(dailyGoal)}</strong>
          </span>
        ) : (
          <Link href="/painel/metas" className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">
            Definir meta de faturamento
          </Link>
        )}
      </div>

      <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-7">
            <div>
              <p className="text-[13px] text-ink-2">Se todos vierem</p>
              <p className="font-display text-[38px] leading-[1.1] font-bold tracking-tight text-ink tabular-nums">
                {formatCurrency(best)}
              </p>
            </div>
            <div className="pb-1">
              <p className="text-[13px] text-ink-2">Previsão realista</p>
              <p className="font-display text-2xl font-bold text-primary tabular-nums">{formatCurrency(realistic)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex h-3.5 gap-0.5 rounded-full overflow-hidden bg-line-2" aria-hidden="true">
              <div className="bg-ink" style={{ width: pct(done.value, scale) }} />
              <div className="bg-primary" style={{ width: pct(confirmed.value, scale) }} />
              <div className="bg-primary/40" style={{ width: pct(unconfirmed.value, scale) }} />
            </div>
            <div className="flex justify-between text-xs text-ink-3 tabular-nums">
              <span>R$ 0</span>
              {goalPct !== null && (
                <span>
                  {goalPct}% da meta{missing > 0 ? ` · faltam ${formatCurrency(missing)}` : " · meta batida"}
                </span>
              )}
              <span>{formatCurrency(scale)}</span>
            </div>
          </div>

          <div className="flex flex-col">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-2.5 min-h-9 border-t border-line-3">
                <span className={`w-2.5 h-2.5 rounded-[3px] ${r.swatch}`} />
                <span className="flex-1 text-sm text-ink">
                  {r.label} <span className="text-ink-3">· {r.detail}</span>
                </span>
                {r.label === "Sem confirmação" && confirmLink && (
                  <a
                    href={confirmLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-line text-xs font-semibold text-ink hover:bg-ground"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Pedir confirmação
                  </a>
                )}
                <span className="w-24 text-right text-sm font-semibold text-ink tabular-nums">{formatCurrency(r.value)}</span>
              </div>
            ))}
            {noShow.count > 0 && (
              <div className="flex items-center gap-2.5 min-h-9 border-t border-line-3">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-danger-strong" />
                <span className="flex-1 text-sm text-ink">
                  Perdido com falta <span className="text-ink-3">· {noShow.count} cliente{noShow.count !== 1 ? "s" : ""}</span>
                </span>
                <span className="w-24 text-right text-sm font-semibold text-danger tabular-nums">− {formatCurrency(noShow.value)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:pl-8 lg:border-l border-line-2 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">Por horário</span>
            <div className="flex flex-wrap gap-3.5 text-xs text-ink-2">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-ink" />Realizado</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-primary" />Confirmado</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-primary/40" />Sem confirmação</span>
            </div>
          </div>
          {byHour.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-3">A barbearia não abre hoje.</p>
          ) : (
            <>
              <div className="flex items-end gap-2 h-44 border-b border-bar-soft">
                {byHour.map((h) => {
                  const total = h.done + h.confirmed + h.unconfirmed;
                  return (
                    <div
                      key={h.hour}
                      title={`${h.hour}h · ${formatCurrency(total)}`}
                      className="flex-1 flex flex-col justify-end rounded-t overflow-hidden"
                      style={{ height: `${(total / hourMax) * 100}%` }}
                    >
                      <div className="bg-primary/40" style={{ flexGrow: h.unconfirmed }} />
                      <div className="bg-primary" style={{ flexGrow: h.confirmed }} />
                      <div className="bg-ink" style={{ flexGrow: h.done }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                {byHour.map((h) => (
                  <span
                    key={h.hour}
                    className={`flex-1 text-center text-[11px] ${h.hour === nowHour ? "font-bold text-primary" : "text-ink-4"}`}
                  >
                    {h.hour === nowHour ? "agora" : `${h.hour}h`}
                  </span>
                ))}
              </div>
              {peak.total > 0 && (
                <p className="text-[13px] text-ink-2">
                  Pico previsto às <strong className="text-ink">{peak.hour}h</strong> ({formatCurrency(peak.total)}).
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
