"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Calendar,
  DollarSign,
  Users,
  Target,
  Loader2,
  RefreshCw,
  UserPlus,
  TrendingUp,
  BadgeCheck,
  Banknote,
  CalendarRange,
  ChevronDown,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SkeletonKpi } from "@/components/ui/SkeletonCard";

// Custom Sub-components
import { TodayHero } from "./components/TodayHero";
import { KpiCard } from "./components/KpiCard";
import { ChartsSection } from "./components/ChartsSection";
import { RankingsSection } from "./components/RankingsSection";
import { NpsFidelitySection } from "./components/NpsFidelitySection";
import { OccupationBirthdaysSection } from "./components/OccupationBirthdaysSection";
import { TodayAgenda } from "./components/TodayAgenda";

type Period = "today" | "7d" | "30d" | "month" | "custom";

interface KpiData {
  value: number;
  change: number | null;
  prevValue: number;
}

interface DashboardData {
  period: string;
  periodLabel: string;
  today: {
    appointments: Array<{
      id: string;
      startTime: string;
      status: string;
      client: { name: string };
      service: { name: string; price: number; duration: number };
      barber: { user: { name: string } };
    }>;
    total: number;
    done: number;
    pending: number;
    noShow: number;
    revenue: number;
    expectedRevenue: number;
    nextAppointment: {
      startTime: string;
      client: { name: string };
      service: { name: string };
      barber: { user: { name: string } };
    } | null;
  };
  whatsapp: { status: string; lastConnectedAt: string | null };
  kpis: {
    revenue: KpiData;
    appointments: KpiData;
    ticketMedio: KpiData;
    clients: KpiData;
    newClients: number;
    returningClients: number;
    productSales: number;
  };
  mrr: number;
  activeSubscriptions: number;
  activeBarbers: number;
  projecaoMes: number;
  comissoes: { totalPago: number; totalVales: number; barbeirosPagos: number };
  topBarbers: Array<{
    id: string;
    name: string;
    revenue: number;
    appointments: number;
  }>;
  topClients: Array<{
    id: string;
    name: string;
    totalSpent: number;
    visits: number;
  }>;
  nps: {
    score: number | null;
    change: number | null;
    level: string;
    average: number;
    total: number;
    promoters: number;
    passives: number;
    detractors: number;
  };
  charts: {
    dailyRevenue: Array<{ date: string; revenue: number }>;
    appointmentStatus: {
      DONE: number;
      PENDING: number;
      CANCELLED: number;
      NO_SHOW: number;
    };
  };
  birthdaysThisMonth: Array<{
    id: string;
    name: string;
    phone: string | null;
    day: number;
  }>;
  occupation: {
    pct: number;
    status: string;
    usedMinutes: number;
    availableMinutes: number;
  };
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Este mês" },
];

// Helpers
function toDateInputValue(date: Date) {
  return date.toISOString().split("T")[0]; // "YYYY-MM-DD"
}
function formatDisplayDate(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function DashboardPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);

  // Calendar picker state
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
        if (p === "custom" && from && to) {
          url += `&from=${from}&to=${to}`;
        }
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Erro ao carregar Dashboard.");
        }
        setData(json);
      } catch (err: any) {
        toast.error(err.message || "Erro de conexão ao carregar Dashboard.");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (period !== "custom") loadData(period);
  }, [period, loadData]);

  // Fecha o popover ao clicar fora
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
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

  function changePeriod(p: Period) {
    if (p === "custom") {
      setShowCalendar(true);
      return;
    }
    setShowCalendar(false);
    setPeriod(p);
  }

  // Label do período customizado
  const customLabel =
    period === "custom" && customFrom && customTo
      ? `${formatDisplayDate(customFrom)} → ${formatDisplayDate(customTo)}`
      : "Personalizado";

  if ((data as any)?.error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <p className="font-bold">Erro ao carregar Dashboard:</p>
        <p className="text-sm">{(data as any).error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* === HEADER + PERIOD FILTER === */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{formatDate(new Date())}</p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => changePeriod(key)}
                className={`px-4 py-2 text-xs font-bold transition-all ${
                  period === key
                    ? "bg-primary text-white"
                    : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Botão Personalizado + Popover */}
          <div className="relative" ref={calendarRef}>
            <button
              onClick={() => setShowCalendar((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                period === "custom"
                  ? "bg-primary text-white border-primary"
                  : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span className="max-w-[160px] truncate">{customLabel}</span>
              {period === "custom" ? (
                <X
                  className="w-3 h-3 ml-0.5 opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPeriod("month");
                    setShowCalendar(false);
                  }}
                />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {/* Popover calendário */}
            {showCalendar && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl border border-zinc-200 shadow-xl p-5 w-72 animate-in fade-in slide-in-from-top-2 duration-150">
                <p className="text-xs font-bold text-zinc-700 mb-3 flex items-center gap-2">
                  <CalendarRange className="w-4 h-4 text-primary" />
                  Período personalizado
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                      Data inicial
                    </label>
                    <input
                      type="date"
                      value={customFrom}
                      max={customTo || today}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-zinc-50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                      Data final
                    </label>
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom}
                      max={today}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-zinc-50"
                    />
                  </div>
                </div>

                {/* Atalhos rápidos */}
                <div className="mt-3 pt-3 border-t border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Atalhos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Ontem", days: 1 },
                      { label: "Últ. 7d", days: 7 },
                      { label: "Últ. 14d", days: 14 },
                      { label: "Últ. 30d", days: 30 },
                      { label: "Últ. 60d", days: 60 },
                      { label: "Últ. 90d", days: 90 },
                    ].map(({ label, days }) => (
                      <button
                        key={label}
                        onClick={() => {
                          const t = new Date();
                          const f = new Date();
                          f.setDate(f.getDate() - (days - 1));
                          setCustomFrom(toDateInputValue(f));
                          setCustomTo(toDateInputValue(t));
                        }}
                        className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-primary/10 hover:text-primary text-zinc-600 text-[10px] font-bold transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={applyCustomRange}
                  disabled={!customFrom || !customTo}
                  className="mt-4 w-full py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-40 transition-all"
                >
                  Aplicar período
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Skeleton global enquanto carrega pela primeira vez */}
      {loading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonKpi key={i} />)}
        </div>
      )}

      {data && <>

      {/* === HERO — RAIO-X DE HOJE === */}
      <TodayHero today={data.today} whatsapp={data.whatsapp} />

      {/* === KPIs COMPARATIVOS === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Faturamento"
          value={data.kpis.revenue.value}
          change={data.kpis.revenue.change}
          prevValue={data.kpis.revenue.prevValue}
          isCurrency
          icon={DollarSign}
          color="bg-green-50 text-green-600"
        />
        <KpiCard
          title="Atendimentos"
          value={data.kpis.appointments.value}
          change={data.kpis.appointments.change}
          prevValue={data.kpis.appointments.prevValue}
          icon={Calendar}
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          title="Ticket Médio"
          value={data.kpis.ticketMedio.value}
          change={data.kpis.ticketMedio.change}
          prevValue={data.kpis.ticketMedio.prevValue}
          isCurrency
          icon={Target}
          color="bg-purple-50 text-purple-600"
        />
        <KpiCard
          title="Clientes Únicos"
          value={data.kpis.clients.value}
          change={data.kpis.clients.change}
          prevValue={data.kpis.clients.prevValue}
          icon={Users}
          color="bg-amber-50 text-amber-600"
        />
      </div>

      {/* MRR + Novos vs Recorrentes + Projeção */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* MRR */}
        <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-primary animate-spin-slow" />
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              MRR (Recorrência)
            </span>
          </div>
          <p className="text-2xl font-black text-zinc-900">{formatCurrency(data.mrr)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {data.activeSubscriptions} assinantes ativos
          </p>
        </div>

        {/* Novos vs Recorrentes */}
        <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Novos vs Recorrentes
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xl font-black text-blue-600">{data.kpis.newClients}</p>
              <p className="text-[10px] text-zinc-400">novos</p>
            </div>
            <div className="text-zinc-300 text-lg font-light">/</div>
            <div>
              <p className="text-2xl font-black text-green-600">
                {data.kpis.returningClients}
              </p>
              <p className="text-[10px] text-zinc-400">recorrentes</p>
            </div>
          </div>
          {data.kpis.newClients + data.kpis.returningClients > 0 && (
            <div className="mt-2 h-2 rounded-full bg-zinc-100 overflow-hidden flex">
              <div
                className="h-full bg-blue-400 rounded-l-full"
                style={{
                  width: `${Math.round(
                    (data.kpis.newClients /
                      (data.kpis.newClients + data.kpis.returningClients)) *
                      100
                  )}%`,
                }}
              />
              <div
                className="h-full bg-green-400 rounded-r-full"
                style={{
                  width: `${Math.round(
                    (data.kpis.returningClients /
                      (data.kpis.newClients + data.kpis.returningClients)) *
                      100
                  )}%`,
                }}
              />
            </div>
          )}
        </div>

        {/* Projeção */}
        <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Projeção do Mês
            </span>
          </div>
          <p className="text-2xl font-black text-zinc-900">
            {formatCurrency(data.projecaoMes)}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">com base no ritmo atual</p>
        </div>
      </div>

      {/* Comissões */}
      {(data.comissoes.totalPago > 0 || data.comissoes.totalVales > 0) && (
        <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-zinc-700">Comissões do Mês</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data.comissoes.totalPago > 0 && (
              <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <BadgeCheck className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-bold text-green-700">Pago</span>
                </div>
                <p className="text-lg font-black text-green-700">
                  {formatCurrency(data.comissoes.totalPago)}
                </p>
                <p className="text-[10px] text-green-600">
                  {data.comissoes.barbeirosPagos} profissional(is)
                </p>
              </div>
            )}
            {data.comissoes.totalVales > 0 && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <Banknote className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs font-bold text-red-600">Vales</span>
                </div>
                <p className="text-lg font-black text-red-500">
                  {formatCurrency(data.comissoes.totalVales)}
                </p>
                <p className="text-[10px] text-red-400">adiantamentos</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === GRÁFICOS (VISUALIZAÇÃO DE DADOS) === */}
      <ChartsSection
        dailyRevenue={data.charts.dailyRevenue}
        appointmentStatus={data.charts.appointmentStatus}
      />

      {/* === RANKINGS === */}
      <RankingsSection
        topBarbers={data.topBarbers}
        topClients={data.topClients}
        periodLabel={data.periodLabel}
      />

      {/* === ECOSSISTEMA DE AVALIAÇÕES (NPS & FIDELIDADE) === */}
      <NpsFidelitySection nps={data.nps} />

      {/* === GAUGE + ANIVERSARIANTES === */}
      <OccupationBirthdaysSection
        occupation={data.occupation}
        birthdaysThisMonth={data.birthdaysThisMonth}
      />

      {/* === AGENDA DE HOJE === */}
      <TodayAgenda appointments={data.today.appointments} total={data.today.total} />

      {/* === FLOATING ACTION BUTTON === */}
      <a
        href="/painel/agendamentos"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-primary text-white font-bold text-sm shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all"
      >
        <Calendar className="w-4 h-4" />
        Novo Agendamento
      </a>

      </>}
    </div>
  );
}
