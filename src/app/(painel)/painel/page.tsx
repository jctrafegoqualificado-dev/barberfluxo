"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Calendar, DollarSign, Users, Clock, CheckCircle, TrendingUp, TrendingDown,
  UserPlus, RefreshCw, Banknote, BadgeCheck, Wifi, WifiOff, Sparkles,
  Crown, ChevronRight, BarChart3, ArrowUpRight, ArrowDownRight, Target, Loader2,
  PieChart as PieChartIcon, Gift, MessageCircle, Zap
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

type Period = "today" | "7d" | "30d" | "month";

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
      id: string; startTime: string; status: string;
      client: { name: string };
      service: { name: string; price: number; duration: number };
      barber: { user: { name: string } };
    }>;
    total: number; done: number; pending: number; noShow: number;
    revenue: number; expectedRevenue: number;
    nextAppointment: {
      startTime: string;
      client: { name: string };
      service: { name: string };
      barber: { user: { name: string } };
    } | null;
  };
  whatsapp: { status: string; lastConnectedAt: string | null };
  kpis: {
    revenue: KpiData; appointments: KpiData; ticketMedio: KpiData; clients: KpiData;
    newClients: number; returningClients: number; productSales: number;
  };
  mrr: number; activeSubscriptions: number; activeBarbers: number; projecaoMes: number;
  comissoes: { totalPago: number; totalVales: number; barbeirosPagos: number };
  topBarbers: Array<{ id: string; name: string; revenue: number; appointments: number }>;
  topClients: Array<{ id: string; name: string; totalSpent: number; visits: number }>;
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
    appointmentStatus: { DONE: number; PENDING: number; CANCELLED: number; NO_SHOW: number };
  };
  birthdaysThisMonth: Array<{ id: string; name: string; phone: string | null; day: number }>;
  occupation: { pct: number; status: string; usedMinutes: number; availableMinutes: number };
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Este mês" },
];

function KpiCard({ title, value, change, prevValue, isCurrency, icon: Icon, color }: {
  title: string; value: number; change: number | null; prevValue?: number;
  isCurrency?: boolean; icon: React.ElementType; color: string;
}) {
  const positive = change !== null && change >= 0;
  const formatVal = (v: number) => isCurrency ? formatCurrency(v) : v.toLocaleString("pt-BR");

  return (
    <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-5 hover:shadow-md transition-all hover:-translate-y-0.5 group">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== null ? (
          <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full transition-all ${
            positive ? "bg-green-50 text-green-600 border border-green-100" : "bg-red-50 text-red-500 border border-red-100"
          }`}>
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {positive ? "+" : ""}{change}%
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-zinc-50 text-zinc-400 border border-zinc-100">
            <span>Novo período</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-black text-zinc-900 tracking-tight">
        {formatVal(value)}
      </p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-zinc-500 font-medium">{title}</p>
        {prevValue !== undefined && prevValue > 0 && (
          <p className="text-[10px] text-zinc-400">
            vs <span className="font-bold text-zinc-500">{formatVal(prevValue)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/barbershop/dashboard?period=${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setData(json);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(period); }, [period, loadData]);

  function changePeriod(p: Period) {
    setPeriod(p);
  }

  if (!data && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;
  if ((data as any).error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <p className="font-bold">Erro ao carregar Dashboard:</p>
        <p className="text-sm">{(data as any).error}</p>
      </div>
    );
  }

  const maxBarberRevenue = data.topBarbers?.[0]?.revenue || 1;
  const maxClientSpent = data.topClients?.[0]?.totalSpent || 1;

  const wsConnected = data.whatsapp?.status === "CONNECTED";

  return (
    <div className="space-y-6">
      {/* === HEADER + PERIOD FILTER === */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{formatDate(new Date())}</p>
        </div>

        {/* Period Selector */}
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
      </div>

      {/* === FASE 2: HERO — RAIO-X DE HOJE === */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-2xl -ml-10 -mb-10" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary" />
              <h2 className="text-lg font-bold">Raio-X de Hoje</h2>
            </div>

            {/* WhatsApp Status Pulse */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${wsConnected ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
              <span className={`relative flex h-2.5 w-2.5 ${wsConnected ? "" : ""}`}>
                {wsConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${wsConnected ? "bg-green-400" : "bg-yellow-400"}`} />
              </span>
              {wsConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {wsConnected ? "WhatsApp Online" : "WhatsApp Offline"}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Next Client */}
            <div className="col-span-2 sm:col-span-1 bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <p className="text-xs text-zinc-400 font-medium mb-1">Próximo Cliente</p>
              {data.today.nextAppointment ? (
                <>
                  <p className="text-lg font-black">{data.today.nextAppointment.client.name.split(" ")[0]}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {data.today.nextAppointment.startTime} · {data.today.nextAppointment.service.name}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    com {data.today.nextAppointment.barber.user.name}
                  </p>
                </>
              ) : (
                <p className="text-sm text-zinc-500 mt-1">Nenhum pendente</p>
              )}
            </div>

            {/* Today Metrics */}
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <p className="text-xs text-zinc-400 font-medium mb-1">Agendamentos</p>
              <p className="text-2xl font-black">{data.today.total}</p>
              <p className="text-[10px] text-zinc-500">{data.today.done} feitos · {data.today.pending} pendentes</p>
            </div>

            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <p className="text-xs text-zinc-400 font-medium mb-1">Faturado Hoje</p>
              <p className="text-2xl font-black text-green-400">{formatCurrency(data.today.revenue)}</p>
              <p className="text-[10px] text-zinc-500">de {formatCurrency(data.today.expectedRevenue)} previsto</p>
            </div>

            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
              <p className="text-xs text-zinc-400 font-medium mb-1">No-Show Hoje</p>
              <p className={`text-2xl font-black ${data.today.noShow > 0 ? "text-red-400" : "text-green-400"}`}>
                {data.today.noShow}
              </p>
              <p className="text-[10px] text-zinc-500">faltas registradas</p>
            </div>
          </div>
        </div>
      </div>

      {/* === FASE 3: KPIs COMPARATIVOS === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Faturamento"
          value={data.kpis.revenue.value}
          change={data.kpis.revenue.change}
          prevValue={data.kpis.revenue.prevValue}
          isCurrency icon={DollarSign}
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
          isCurrency icon={Target}
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
            <RefreshCw className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">MRR (Recorrência)</span>
          </div>
          <p className="text-2xl font-black text-zinc-900">{formatCurrency(data.mrr)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{data.activeSubscriptions} assinantes ativos</p>
        </div>

        {/* Novos vs Recorrentes */}
        <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Novos vs Recorrentes</span>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xl font-black text-blue-600">{data.kpis.newClients}</p>
              <p className="text-[10px] text-zinc-400">novos</p>
            </div>
            <div className="text-zinc-300 text-lg font-light">/</div>
            <div>
              <p className="text-2xl font-black text-green-600">{data.kpis.returningClients}</p>
              <p className="text-[10px] text-zinc-400">recorrentes</p>
            </div>
          </div>
          {(data.kpis.newClients + data.kpis.returningClients) > 0 && (
            <div className="mt-2 h-2 rounded-full bg-zinc-100 overflow-hidden flex">
              <div
                className="h-full bg-blue-400 rounded-l-full"
                style={{ width: `${Math.round((data.kpis.newClients / (data.kpis.newClients + data.kpis.returningClients)) * 100)}%` }}
              />
              <div
                className="h-full bg-green-400 rounded-r-full"
                style={{ width: `${Math.round((data.kpis.returningClients / (data.kpis.newClients + data.kpis.returningClients)) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Projeção */}
        <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Projeção do Mês</span>
          </div>
          <p className="text-2xl font-black text-zinc-900">{formatCurrency(data.projecaoMes)}</p>
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
                <p className="text-lg font-black text-green-700">{formatCurrency(data.comissoes.totalPago)}</p>
                <p className="text-[10px] text-green-600">{data.comissoes.barbeirosPagos} profissional(is)</p>
              </div>
            )}
            {data.comissoes.totalVales > 0 && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <Banknote className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs font-bold text-red-600">Vales</span>
                </div>
                <p className="text-lg font-black text-red-500">{formatCurrency(data.comissoes.totalVales)}</p>
                <p className="text-[10px] text-red-400">adiantamentos</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === FASE 6: GRÁFICOS (VISUALIZAÇÃO DE DADOS) === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Faturamento Diário (Bar Chart) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-150 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-zinc-900 text-sm">Faturamento Diário</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.dailyRevenue} barCategoryGap="30%">
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#A1A1AA' }} axisLine={false} tickLine={false} interval={Math.ceil(data.charts.dailyRevenue.length / 10)} />
                <YAxis tickFormatter={(val) => `R$${val}`} tick={{ fontSize: 10, fill: '#A1A1AA' }} axisLine={false} tickLine={false} width={45} />
                <RechartsTooltip
                  formatter={(val: number) => [formatCurrency(val), "Faturamento"]}
                  labelFormatter={(label) => `📅 ${label}`}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #F3F4F6', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)', padding: '8px 12px' }}
                  labelStyle={{ fontWeight: '700', color: '#18181B', marginBottom: '2px' }}
                  itemStyle={{ color: '#F59E0B', fontWeight: '600' }}
                  cursor={{ fill: '#FEF3C7', radius: 4 }}
                />
                <Bar dataKey="revenue" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status dos Agendamentos (Donut Chart) */}
        <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-4 h-4 text-blue-500" />
            <h3 className="font-bold text-zinc-900 text-sm">Status dos Agendamentos</h3>
          </div>
          {(() => {
            const donutData = [
              { name: 'Finalizados', value: data.charts.appointmentStatus.DONE, color: '#10B981' },
              { name: 'Pendentes', value: data.charts.appointmentStatus.PENDING, color: '#3B82F6' },
              { name: 'Cancelados', value: data.charts.appointmentStatus.CANCELLED, color: '#EF4444' },
              { name: 'No-Show', value: data.charts.appointmentStatus.NO_SHOW, color: '#F59E0B' },
            ];
            const total = donutData.reduce((a, b) => a + b.value, 0);
            return (
              <>
                <div className="h-44 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        innerRadius={52}
                        outerRadius={72}
                        paddingAngle={4}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: number, name: string) => [val, name]}
                        contentStyle={{ borderRadius: '10px', border: '1px solid #F3F4F6', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)', padding: '6px 10px' }}
                        itemStyle={{ fontWeight: '600', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-zinc-900">{total}</span>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Total</span>
                  </div>
                </div>
                {/* Legenda */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 pt-3 border-t border-zinc-100">
                  {donutData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] text-zinc-500 font-medium truncate">{item.name}</span>
                      <span className="text-[10px] font-black text-zinc-800 ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* === FASE 4: RANKINGS === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Profissionais */}
        <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-zinc-900 text-sm">Top Profissionais</h3>
            </div>
            <span className="text-[10px] text-zinc-400 font-medium uppercase">{data.periodLabel}</span>
          </div>
          {data.topBarbers.length === 0 ? (
            <div className="py-10 text-center text-zinc-400 text-sm">Sem dados no período</div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {data.topBarbers.map((b, i) => (
                <div key={b.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-zinc-50/50 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-zinc-200 text-zinc-600" : i === 2 ? "bg-orange-100 text-orange-600" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {i + 1}º
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{b.name}</p>
                    <p className="text-[10px] text-zinc-400">{b.appointments} atendimentos</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-zinc-900">{formatCurrency(b.revenue)}</p>
                    <div className="w-24 h-1.5 rounded-full bg-zinc-100 mt-1 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.round((b.revenue / maxBarberRevenue) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Clientes */}
        <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <h3 className="font-bold text-zinc-900 text-sm">Top Clientes</h3>
            </div>
            <span className="text-[10px] text-zinc-400 font-medium uppercase">{data.periodLabel}</span>
          </div>
          {data.topClients.length === 0 ? (
            <div className="py-10 text-center text-zinc-400 text-sm">Sem dados no período</div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {data.topClients.map((c, i) => (
                <div key={c.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-zinc-50/50 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                    i === 0 ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{c.name}</p>
                    <p className="text-[10px] text-zinc-400">{c.visits} visitas</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-zinc-900">{formatCurrency(c.totalSpent)}</p>
                    <div className="w-24 h-1.5 rounded-full bg-zinc-100 mt-1 overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${Math.round((c.totalSpent / maxClientSpent) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* === FASE 5: ECOSSISTEMA DE AVALIAÇÕES (NPS & FIDELIDADE) === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Termômetro NPS */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-150 shadow-sm p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-zinc-900 text-sm">Termômetro de Satisfação (NPS)</h3>
            </div>
            {data.nps.score !== null && (
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                data.nps.level === "EXCELENTE" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                data.nps.level === "MUITO BOM" ? "bg-blue-50 text-blue-600 border border-blue-100" :
                data.nps.level === "CRÍTICO" ? "bg-red-50 text-red-600 border border-red-100" :
                "bg-amber-50 text-amber-600 border border-amber-100"
              }`}>
                Zona: {data.nps.level}
              </span>
            )}
          </div>

          {data.nps.score === null ? (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-400 text-center">
              <Sparkles className="w-8 h-8 text-zinc-300 mb-2 animate-pulse" />
              <p className="text-sm font-medium">Nenhuma avaliação recebida ainda no período</p>
              <p className="text-[11px] text-zinc-400 mt-1 max-w-xs">Envie avaliações concluindo os atendimentos de hoje para calibrar o termômetro!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              
              {/* Círculo do Score */}
              <div className="flex flex-col items-center justify-center text-center p-4 bg-zinc-50 rounded-2xl border border-zinc-100 relative">
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-ping" />
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">NPS Score</p>
                <p className={`text-4xl font-black mt-2 tracking-tight ${
                  data.nps.score >= 75 ? "text-emerald-600" :
                  data.nps.score >= 50 ? "text-blue-500" :
                  data.nps.score >= 0 ? "text-amber-500" :
                  "text-red-500"
                }`}>
                  {data.nps.score > 0 ? `+${data.nps.score}` : data.nps.score}
                </p>
                <div className="flex items-center gap-1 mt-2 text-xs font-bold text-zinc-500">
                  <span>Média:</span>
                  <span className="text-zinc-700">{data.nps.average} / 10</span>
                </div>
              </div>

              {/* Termômetro Linear */}
              <div className="md:col-span-2 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-zinc-500">
                    <span>Evolução do Termômetro (-100 a +100)</span>
                    <span className="text-zinc-700">{data.nps.score > 0 ? `+${data.nps.score}` : data.nps.score}</span>
                  </div>
                  
                  {/* Régua de Temperatura */}
                  <div className="h-4 w-full rounded-full bg-zinc-100 p-0.5 border border-zinc-200 relative overflow-hidden flex">
                    <div className="w-1/2 h-full bg-red-100 border-r border-dashed border-red-300" />
                    <div className="w-1/4 h-full bg-amber-50 border-r border-dashed border-amber-200" />
                    <div className="w-1/4 h-full bg-emerald-50" />
                    
                    {/* Indicador de Agulha */}
                    <div 
                      className="absolute top-0 bottom-0 w-2.5 bg-zinc-900 border border-white rounded-full shadow-md transition-all duration-1000 -ml-1.5"
                      style={{ left: `${((data.nps.score + 100) / 200) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-zinc-400 font-bold uppercase tracking-wider px-1">
                    <span className="text-red-500">Crítico</span>
                    <span className="text-amber-500">Bom</span>
                    <span className="text-emerald-500">Excelente</span>
                  </div>
                </div>

                {/* Proporção de Categorias */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100">
                  <div className="space-y-1 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-zinc-500 font-bold">Promotores</span>
                    </div>
                    <p className="text-sm font-black text-emerald-600">{data.nps.promoters} <span className="text-[10px] text-zinc-400 font-medium">({Math.round((data.nps.promoters / data.nps.total) * 100)}%)</span></p>
                  </div>
                  <div className="space-y-1 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-[10px] text-zinc-500 font-bold">Passivos</span>
                    </div>
                    <p className="text-sm font-black text-amber-500">{data.nps.passives} <span className="text-[10px] text-zinc-400 font-medium">({Math.round((data.nps.passives / data.nps.total) * 100)}%)</span></p>
                  </div>
                  <div className="space-y-1 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-[10px] text-zinc-500 font-bold">Detratores</span>
                    </div>
                    <p className="text-sm font-black text-red-500">{data.nps.detractors} <span className="text-[10px] text-zinc-400 font-medium">({Math.round((data.nps.detractors / data.nps.total) * 100)}%)</span></p>
                  </div>
                </div>

              </div>

            </div>
          )}
        </div>

        {/* Gamificação de Fidelidade */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl border border-zinc-800 p-6 text-white relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-widest text-amber-400">Fidelidade SaaS</span>
              </div>
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>

            <h4 className="text-lg font-black tracking-tight text-white mb-2 leading-tight">Retenção Ativa via WhatsApp</h4>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Cada atendimento concluído dispara uma pesquisa automatizada. A resposta gera engajamento imediato e fideliza o cliente!
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-zinc-800/40 rounded-xl p-4 border border-zinc-800/60 backdrop-blur-sm">
            <div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Avaliações</p>
              <p className="text-2xl font-black text-white mt-1">{data.nps.total}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pontos Gerados</p>
              <p className="text-2xl font-black text-amber-400 mt-1">{data.nps.total * 10} pts</p>
            </div>
          </div>
        </div>
      </div>

      {/* === EPIC 3: GAUGE + ANIVERSARIANTES === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Gauge de Ocupação da Equipe */}
        <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-zinc-900 text-sm">Ocupação da Equipe</h3>
          </div>
          <div className="h-40 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { value: data.occupation.pct, fill: data.occupation.pct >= 80 ? '#EF4444' : data.occupation.pct >= 50 ? '#10B981' : '#3B82F6' },
                    { value: 100 - data.occupation.pct, fill: '#F4F4F5' },
                  ]}
                  startAngle={180}
                  endAngle={0}
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={0}
                  dataKey="value"
                  strokeWidth={0}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none pb-4">
              <span className={`text-3xl font-black ${
                data.occupation.pct >= 80 ? 'text-red-500' : data.occupation.pct >= 50 ? 'text-emerald-600' : 'text-blue-500'
              }`}>{data.occupation.pct}%</span>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mt-1 ${
                data.occupation.status === 'SOBRECARGA' ? 'bg-red-50 text-red-500' :
                data.occupation.status === 'IDEAL' ? 'bg-emerald-50 text-emerald-600' :
                'bg-blue-50 text-blue-500'
              }`}>{data.occupation.status}</span>
            </div>
          </div>
          <p className="text-[10px] text-zinc-400 text-center mt-2">
            {Math.round(data.occupation.usedMinutes / 60)}h usadas de {Math.round(data.occupation.availableMinutes / 60)}h disponíveis
          </p>
        </div>

        {/* Aniversariantes do Mês */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-pink-500" />
              <h3 className="font-bold text-zinc-900 text-sm">Aniversários em Maio</h3>
            </div>
            <span className="text-[10px] text-pink-500 font-bold bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
              {data.birthdaysThisMonth.length} cliente{data.birthdaysThisMonth.length !== 1 ? 's' : ''}
            </span>
          </div>
          {data.birthdaysThisMonth.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-400">
              <Gift className="w-8 h-8 mb-2 text-zinc-200" />
              <p className="text-sm">Nenhum aniversário este mês</p>
              <p className="text-[11px] text-zinc-300 mt-1">Cadastre as datas de nascimento dos clientes</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50 max-h-52 overflow-y-auto">
              {data.birthdaysThisMonth.map((c) => {
                const phone = c.phone?.replace(/\D/g, '');
                const msg = encodeURIComponent(`Parabéns, ${c.name.split(' ')[0]}! 🎂 A equipe da barbearia deseja um feliz aniversário!`);
                return (
                  <div key={c.id} className="px-5 py-3 flex items-center gap-4 hover:bg-zinc-50/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-pink-500">{c.day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-900 truncate">{c.name}</p>
                      <p className="text-[10px] text-zinc-400">Dia {c.day} de maio</p>
                    </div>
                    {phone && (
                      <a
                        href={`https://wa.me/55${phone}?text=${msg}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-600 text-[11px] font-bold hover:bg-green-100 transition-colors border border-green-100 shrink-0"
                      >
                        <MessageCircle className="w-3 h-3" />
                        Felicitar
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* === AGENDA DE HOJE === */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-150 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900">Agenda de Hoje</h2>
          <span className="text-[10px] text-zinc-400 font-bold uppercase">{data.today.total} agendamento{data.today.total !== 1 ? "s" : ""}</span>
        </div>
        {data.today.appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <Calendar className="w-10 h-10 mb-2" />
            <p className="text-sm">Nenhum agendamento para hoje</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {data.today.appointments.map((a) => (
              <div key={a.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-zinc-50/50 transition-colors">
                <div className="w-14 text-center shrink-0">
                  <span className="text-sm font-black text-zinc-900">{a.startTime}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{a.client.name}</p>
                  <p className="text-[10px] text-zinc-500">{a.service.name} · {a.barber.user.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-zinc-700">{formatCurrency(a.service.price)}</p>
                </div>
                <Badge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === US-07: FAB - AÇÃO RÁPIDA === */}
      <a
        href="/painel/agendamentos"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-primary text-white font-bold text-sm shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all"
      >
        <Calendar className="w-4 h-4" />
        Novo Agendamento
      </a>
    </div>
  );
}
