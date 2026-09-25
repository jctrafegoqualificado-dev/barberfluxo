"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { CalendarRange, ChevronDown, Plus, X } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { SkeletonKpi } from "@/components/ui/SkeletonCard";

import type { DashboardData } from "./components/dashboard-types";
import { ForecastCard } from "./components/ForecastCard";
import { SubscriptionsDueCard } from "./components/SubscriptionsDueCard";
import { KpiCard } from "./components/KpiCard";
import { ChartsSection } from "./components/ChartsSection";
import { SummaryCards } from "./components/SummaryCards";
import { RankingsSection } from "./components/RankingsSection";
import { TodayAgenda } from "./components/TodayAgenda";
import { NpsCard } from "./components/NpsCard";
import { BirthdaysCard } from "./components/BirthdaysCard";

type Period = "today" | "7d" | "30d" | "month" | "custom";

const PERIODS: { key: Exclude<Period, "custom">; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Este mês" },
];

function toDateInputValue(date: Date) {
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function DashboardPage() {
  const { token, user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);

  const today = toDateInputValue(new Date());
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(
    async (p: Period, from?: string, to?: string) => {
      setLoading(true);
      try {
        let url = `/api/barbershop/dashboard?period=${p}`;
        if (p === "custom" && from && to) url += `&from=${from}&to=${to}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao carregar o início.");
        setData(json);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Erro de conexão ao carregar o início.");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (period !== "custom") loadData(period);
  }, [period, loadData]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) setShowCalendar(false);
    }
    if (showCalendar) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showCalendar]);

  function applyCustomRange() {
    if (!customFrom || !customTo) return;
    const from = customFrom <= customTo ? customFrom : customTo;
    const to = customFrom <= customTo ? customTo : customFrom;
    setPeriod("custom");
    setShowCalendar(false);
    loadData("custom", from, to);
  }

  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(now);
  const customLabel =
    period === "custom" && customFrom && customTo
      ? `${formatDisplayDate(customFrom)} → ${formatDisplayDate(customTo)}`
      : "Personalizado";

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-ink-3 first-letter:uppercase">{dateLabel}</p>
          <h1 className="font-display text-[30px] sm:text-[34px] leading-tight font-bold tracking-tight text-ink">
            {greeting(now.getHours())}
            {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div role="group" aria-label="Período" className="flex p-1 gap-0.5 rounded-[10px] bg-track">
            {PERIODS.map(({ key, label }) => {
              const on = period === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setShowCalendar(false);
                    setPeriod(key);
                  }}
                  className={`h-9 px-3.5 rounded-[7px] text-[13px] font-semibold transition-colors ${
                    on ? "bg-white text-ink shadow-[0_1px_2px_rgba(27,25,22,0.12)]" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <div className="relative" ref={calendarRef}>
              <button
                type="button"
                aria-pressed={period === "custom"}
                aria-expanded={showCalendar}
                onClick={() => setShowCalendar((v) => !v)}
                className={`h-9 px-3 rounded-[7px] text-[13px] font-semibold flex items-center gap-1.5 transition-colors ${
                  period === "custom" ? "bg-white text-ink shadow-[0_1px_2px_rgba(27,25,22,0.12)]" : "text-ink-2 hover:text-ink"
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span className="max-w-[170px] truncate">{customLabel}</span>
                {period === "custom" ? (
                  <X
                    aria-label="Voltar para este mês"
                    className="w-3.5 h-3.5 opacity-70 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPeriod("month");
                      setShowCalendar(false);
                    }}
                  />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showCalendar && (
                <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white rounded-2xl border border-line shadow-xl p-5">
                  <p className="text-sm font-semibold text-ink mb-3">Período personalizado</p>
                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
                      Data inicial
                      <input
                        type="date"
                        value={customFrom}
                        max={customTo || today}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="h-10 rounded-[10px] border border-line px-3 text-sm font-normal text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
                      Data final
                      <input
                        type="date"
                        value={customTo}
                        min={customFrom}
                        max={today}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="h-10 rounded-[10px] border border-line px-3 text-sm font-normal text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                  </div>
                  <div className="mt-3 pt-3 border-t border-line-2 flex flex-wrap gap-1.5">
                    {[
                      { label: "Ontem", days: 1 },
                      { label: "Últ. 14 dias", days: 14 },
                      { label: "Últ. 60 dias", days: 60 },
                      { label: "Últ. 90 dias", days: 90 },
                    ].map(({ label, days }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          const f = new Date();
                          f.setDate(f.getDate() - (days - 1));
                          setCustomFrom(toDateInputValue(f));
                          setCustomTo(toDateInputValue(new Date()));
                        }}
                        className="h-8 px-2.5 rounded-lg bg-ground text-xs font-semibold text-ink-2 hover:text-ink"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={applyCustomRange}
                    disabled={!customFrom || !customTo}
                    className="mt-4 w-full h-10 rounded-[10px] bg-ink text-white text-[13px] font-semibold disabled:opacity-40"
                  >
                    Aplicar período
                  </button>
                </div>
              )}
            </div>
          </div>

          <Link
            href="/painel/agendamentos"
            className="h-11 px-[18px] rounded-[10px] bg-primary text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90"
          >
            <Plus className="w-[18px] h-[18px]" />
            Novo agendamento
          </Link>
        </div>
      </header>

      {loading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonKpi key={i} />
          ))}
        </div>
      )}

      {data && (
        <div className={`flex flex-col gap-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <ForecastCard forecast={data.forecast} appointments={data.today.appointments} />

          <SubscriptionsDueCard data={data.subscriptionsDueToday} />

          {/* Números do período */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            <KpiCard
              title="Faturamento"
              value={data.kpis.revenue.value}
              change={data.kpis.revenue.change}
              prevLabel={`vs ${formatCurrency(data.kpis.revenue.prevValue)}`}
              isCurrency
            />
            <KpiCard
              title="Atendimentos"
              value={data.kpis.appointments.value}
              change={data.kpis.appointments.change}
              prevLabel={`vs ${data.kpis.appointments.prevValue}`}
            />
            <KpiCard
              title="Ticket médio"
              value={data.kpis.ticketMedio.value}
              change={data.kpis.ticketMedio.change}
              prevLabel={`vs ${formatCurrency(data.kpis.ticketMedio.prevValue)}`}
              isCurrency
            />
            <KpiCard
              title="Clientes únicos"
              value={data.kpis.clients.value}
              change={data.kpis.clients.change}
              prevLabel={`vs ${data.kpis.clients.prevValue}`}
            />
            <KpiCard
              title="Novas assinaturas"
              value={`+${data.newSubscriptions.count}`}
              change={data.newSubscriptions.change}
              prevLabel={
                data.newSubscriptions.mrrAdded > 0
                  ? `+${formatCurrency(data.newSubscriptions.mrrAdded)}/mês`
                  : `vs ${data.newSubscriptions.prevCount}`
              }
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
            <div className="flex flex-col gap-6 min-w-0">
              <ChartsSection
                dailyRevenue={data.charts.dailyRevenue}
                appointmentStatus={data.charts.appointmentStatus}
                projecaoMes={data.projecaoMes}
                showProjection={period === "month"}
                periodLabel={data.periodLabel}
              />
              <SummaryCards
                mrr={data.mrr}
                activeSubscriptions={data.activeSubscriptions}
                newSubscriptions={data.newSubscriptions.count}
                occupation={data.occupation}
                comissoes={data.comissoes}
              />
              <RankingsSection
                topBarbers={data.topBarbers}
                topClients={data.topClients}
                newClients={data.kpis.newClients}
                returningClients={data.kpis.returningClients}
              />
            </div>

            <div className="flex flex-col gap-6 min-w-0">
              <TodayAgenda appointments={data.today.appointments} nowHour={data.forecast.nowHour} />
              <NpsCard nps={data.nps} />
              <BirthdaysCard birthdays={data.birthdaysThisMonth} today={now} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
