"use client";
import { useEffect, useState } from "react";
import {
  TrendingUp, DollarSign, Users, Award, Calendar, Smartphone, AlertTriangle,
  CheckCircle2, XCircle, ArrowUpRight, BarChart3, Scissors, Wallet,
  ChevronLeft, ChevronRight, MessageSquare, RefreshCw, BadgeAlert, Sparkles, Settings2,
  LineChart, TrendingDown, Minus, Info
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BillingLog {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  clientName: string;
  planName: string;
}

interface PlanBreakdown {
  name: string;
  price: number;
  count: number;
  total: number;
}

interface ServiceRank {
  name: string;
  count: number;
  revenue: number;
}

interface BarberPerf {
  name: string;
  nickname: string | null;
  count: number;
  gross: number;
  commission: number;
}

interface ClientRank {
  name: string;
  email: string;
  phone: string | null;
  visits: number;
  totalSpent: number;
}

interface RiskClient {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  lastVisit: string;
  daysSince: number;
}

interface BIData {
  range: { from: string; to: string };
  subscriptions: {
    mrr: number;
    active: number;
    overdue: number;
    cancelled: number;
    total: number;
    growth: number;
    adimplenciaRate: number;
    planosBreakdown: PlanBreakdown[];
    billingLogs: BillingLog[];
    poe: {
      poeOwnerPct: number;
      poeBarberPct: number;
      poeDeductFees: boolean;
      poeSubscriptionFee: number;
      poeGrossTotal: number;
      poeTaxas: number;
      poeTotal: number;
      poeBarbearia: number;
      poolBarbeiros: number;
      ticketPorServico: number;
      totalServicos: number;
      partilhaBarbeiros: { id: string; name: string; servicos: number; recebe: number }[];
    };
  };
  atendimentos: {
    totalServices: number;
    revenue: number;
    netRevenue: number;
    avgTicket: number;
    serviceRanking: ServiceRank[];
    barberPerformance: BarberPerf[];
    debitFee: number;
    creditFee: number;
  };
  clientes: {
    ranking: ClientRank[];
    cohort: { new: number; recurrent: number };
    riskList: RiskClient[];
  };
}

type Preset = "thisMonth" | "last7days" | "last30days" | "lastMonth";

export default function IndicadoresPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<BIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"subscriptions" | "services" | "clients" | "forecast">("subscriptions");

  // Forecast state
  interface ForecastPeriod { days: number; label: string; mrrPortion: number; servicesPortion: number; revenue: number; expenses: number; net: number }
  interface ForecastData {
    breakdown: { monthlyMRR: number; activeSubscriptions: number; avgMonthlyServices: number; monthlyFixedExpenses: number; avgMonthlyVarExpenses: number; avgMonthlyExpenses: number; historicalMonths: number };
    periods: ForecastPeriod[];
  }
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [preset, setPreset] = useState<Preset>("thisMonth");

  // POE configuration edit states
  const [showPoeSettings, setShowPoeSettings] = useState(false);
  const [editPoeOwnerPct, setEditPoeOwnerPct] = useState(50);
  const [editPoeDeductFees, setEditPoeDeductFees] = useState(false);
  const [editPoeSubscriptionFee, setEditPoeSubscriptionFee] = useState(0);
  const [isSavingPoe, setIsSavingPoe] = useState(false);
  
  // Pagination & Sorting states for Billing Logs (Subscriptions Tab)
  const [billingPage, setBillingPage] = useState(1);
  const billingRowsPerPage = 8;

  // Pagination & Sorting states for Risk List (Clients Tab)
  const [riskPage, setRiskPage] = useState(1);
  const riskRowsPerPage = 8;

  // Pagination & Sorting states for Top Customers (Clients Tab)
  const [clientRankPage, setClientRankPage] = useState(1);
  const clientRankRowsPerPage = 8;

  // Fetching parameters
  function getDates(p: Preset) {
    const today = new Date();
    let from = new Date(today.getFullYear(), today.getMonth(), 1);
    let to = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    if (p === "last7days") {
      from = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      to = today;
    } else if (p === "last30days") {
      from = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
      to = today;
    } else if (p === "lastMonth") {
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
    }
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    const { from, to } = getDates(preset);
    try {
      const res = await fetch(`/api/barbershop/financeiro/indicadores?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json?.error ?? `Erro ${res.status} ao carregar indicadores`);
        setData(null);
        return;
      }

      setData(json);
      
      // Initialize POE edit states from API response
      if (json?.subscriptions?.poe) {
        setEditPoeOwnerPct(json.subscriptions.poe.poeOwnerPct);
        setEditPoeDeductFees(json.subscriptions.poe.poeDeductFees);
        setEditPoeSubscriptionFee(json.subscriptions.poe.poeSubscriptionFee);
      }

      setBillingPage(1);
      setRiskPage(1);
      setClientRankPage(1);
    } catch (e) {
      console.error(e);
      setError("Falha de conexão ao carregar os dados. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePoeSettings() {
    setIsSavingPoe(true);
    try {
      const res = await fetch("/api/barbershop/financeiro/poe-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          poeOwnerPct: editPoeOwnerPct,
          poeDeductFees: editPoeDeductFees,
          poeSubscriptionFee: editPoeSubscriptionFee,
        }),
      });

      if (!res.ok) {
        throw new Error("Erro ao salvar configurações do POE");
      }

      // Reload data to reflect updated calculations
      await loadData();
      setShowPoeSettings(false);
    } catch (e) {
      console.error(e);
      alert("Falha ao salvar as configurações. Verifique os valores informados.");
    } finally {
      setIsSavingPoe(false);
    }
  }

  useEffect(() => {
    if (token) loadData();
  }, [token, preset]);

  useEffect(() => {
    if (activeTab !== "forecast" || !token || forecast) return;
    setForecastLoading(true);
    fetch("/api/barbershop/financeiro/forecast", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (!d.error) setForecast(d); })
      .finally(() => setForecastLoading(false));
  }, [activeTab, token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full" />
        <p className="text-zinc-500 text-sm font-medium">Carregando inteligência financeira...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-zinc-800 font-bold text-base">Erro ao carregar indicadores</p>
          <p className="text-zinc-500 text-sm mt-1 max-w-sm">{error}</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-amber-500 text-black text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full" />
        <p className="text-zinc-500 text-sm font-medium">Carregando inteligência financeira...</p>
      </div>
    );
  }

  // Subscriptions computations
  const billingLogs = data.subscriptions.billingLogs || [];
  const totalBillingPages = Math.ceil(billingLogs.length / billingRowsPerPage);
  const currentBillingRows = billingLogs.slice(
    (billingPage - 1) * billingRowsPerPage,
    billingPage * billingRowsPerPage
  );

  // Clients computations
  const riskList = data.clientes.riskList || [];
  const totalRiskPages = Math.ceil(riskList.length / riskRowsPerPage);
  const currentRiskRows = riskList.slice(
    (riskPage - 1) * riskRowsPerPage,
    riskPage * riskRowsPerPage
  );

  const clientRanking = data.clientes.ranking || [];
  const totalClientRankPages = Math.ceil(clientRanking.length / clientRankRowsPerPage);
  const currentClientRankRows = clientRanking.slice(
    (clientRankPage - 1) * clientRankRowsPerPage,
    clientRankPage * clientRankRowsPerPage
  );

  // Format Status Badge helper
  const renderPaymentStatus = (status: string) => {
    switch (status) {
      case "PAID":
        return <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full font-semibold"><CheckCircle2 className="w-3 h-3" /> Pago</span>;
      case "PENDING":
        return <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-semibold"><RefreshCw className="w-3 h-3 animate-spin" /> Pendente</span>;
      default:
        return <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded-full font-semibold"><XCircle className="w-3 h-3" /> Falhou</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-amber-500" />
            Indicadores & BI
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">Métricas estratégicas para gestão e tomadas de decisão</p>
        </div>

        {/* Date presets */}
        <div className="flex bg-white rounded-xl shadow-sm border border-zinc-200 p-1 font-medium text-xs">
          {[
            { key: "thisMonth", label: "Este Mês" },
            { key: "last7days", label: "Últimos 7 dias" },
            { key: "last30days", label: "Últimos 30 dias" },
            { key: "lastMonth", label: "Mês Passado" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setPreset(item.key as Preset)}
              className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                preset === item.key
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs list */}
      <div className="border-b border-zinc-200 flex gap-6">
        {[
          { id: "subscriptions", label: "Assinaturas & Receita", icon: Wallet },
          { id: "services", label: "Atendimentos & Serviços", icon: Scissors },
          { id: "clients", label: "Comportamento de Clientes", icon: Users },
          { id: "forecast", label: "Previsão de Receita", icon: LineChart },
        ].map((t) => {
          const ActiveIcon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all relative ${
                activeTab === t.id
                  ? "border-amber-500 text-amber-600 font-bold"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 hover:border-zinc-300"
              }`}
            >
              <ActiveIcon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. ASSINATURAS TAB                                                        */}
      {/* ========================================================================= */}
      {activeTab === "subscriptions" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Subscriptions cards KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Mensal Recorrente (MRR)</p>
                <p className="text-3xl font-black text-zinc-950 mt-1">{formatCurrency(data.subscriptions.mrr)}</p>
              </div>
              <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Base contratada de receita mensal
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Novas Assinaturas</p>
                <p className="text-3xl font-black text-amber-600 mt-1">+{data.subscriptions.growth}</p>
              </div>
              <p className="text-xs text-zinc-400 mt-2">Novos assinantes no período</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Taxa de Adimplência</p>
                <p className="text-3xl font-black text-emerald-600 mt-1">{data.subscriptions.adimplenciaRate}%</p>
              </div>
              <p className="text-xs text-zinc-400 mt-2">Relação de ativos vs vencidos</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total de Assinantes</p>
                <p className="text-3xl font-black text-zinc-950 mt-1">{data.subscriptions.total}</p>
              </div>
              <p className="text-xs text-zinc-500 font-medium mt-2 flex gap-1.5 flex-wrap">
                <span className="text-green-600 font-bold">{data.subscriptions.active} ativos</span>
                <span className="text-zinc-300">·</span>
                <span className="text-red-500 font-bold">{data.subscriptions.overdue} inadimplentes</span>
              </p>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* POE MODEL (Subscription Pool)                                             */}
          {/* ========================================================================= */}
          <div className="bg-zinc-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Scissors className="w-48 h-48 -rotate-12" />
            </div>
            
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-amber-500" />
                  <h2 className="font-bold text-lg">Modelo POE (Pool of Earnings)</h2>
                </div>
                <button
                  onClick={() => setShowPoeSettings(!showPoeSettings)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-850 transition-all flex items-center gap-1.5 self-start"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  {showPoeSettings ? "Fechar Ajustes" : "Ajustar Parâmetros POE"}
                </button>
              </div>

              {/* Ajustes Painel POE */}
              {showPoeSettings && (
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 mb-6 space-y-4 animate-fadeIn">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500">Parâmetros de Repasse & Taxas</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Comissão do Dono */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Repasse Barbearia (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editPoeOwnerPct}
                        onChange={(e) => setEditPoeOwnerPct(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                        placeholder="Ex: 50"
                      />
                    </div>

                    {/* Descontar taxas toggle */}
                    <div className="flex flex-col justify-center">
                      <label className="flex items-center gap-2.5 cursor-pointer mt-5">
                        <input
                          type="checkbox"
                          checked={editPoeDeductFees}
                          onChange={(e) => setEditPoeDeductFees(e.target.checked)}
                          className="rounded border-zinc-850 text-amber-500 bg-zinc-950 focus:ring-amber-500/50 w-4 h-4"
                        />
                        <span className="text-xs font-semibold text-zinc-300">Descontar taxas de cartão/gateway?</span>
                      </label>
                    </div>

                    {/* Taxa customizada se toggle ativo */}
                    {editPoeDeductFees && (
                      <div className="animate-fadeIn">
                        <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Taxa de Desconto Customizada (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={editPoeSubscriptionFee}
                          onChange={(e) => setEditPoeSubscriptionFee(Number(e.target.value))}
                          className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                          placeholder="Ex: 2.5"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      onClick={() => {
                        setShowPoeSettings(false);
                        // Reset states to original values
                        setEditPoeOwnerPct(data.subscriptions.poe.poeOwnerPct);
                        setEditPoeDeductFees(data.subscriptions.poe.poeDeductFees);
                        setEditPoeSubscriptionFee(data.subscriptions.poe.poeSubscriptionFee);
                      }}
                      className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                      disabled={isSavingPoe}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSavePoeSettings}
                      disabled={isSavingPoe}
                      className="px-4 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 font-bold text-black rounded-lg transition-all flex items-center gap-1.5"
                    >
                      {isSavingPoe ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent animate-spin rounded-full" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar Configuração"
                      )}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-zinc-400 text-sm mb-6 max-w-xl">
                Distribuição automática do pote de assinaturas ({formatCurrency(data.subscriptions.poe.poeGrossTotal)}) entre a Barbearia e os Profissionais, baseado no repasse definido de <span className="font-bold text-amber-500">{data.subscriptions.poe.poeOwnerPct}%</span>.
              </p>

              {/* Breakdown do POE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 text-center">
                  <p className="text-xs text-zinc-500 mb-1 font-bold uppercase tracking-wide">MRR Total (Bruto)</p>
                  <p className="text-2xl font-black text-white">{formatCurrency(data.subscriptions.poe.poeGrossTotal)}</p>
                  <p className="text-[10px] text-zinc-400 mt-1">{data.subscriptions.total} assinaturas registradas</p>
                </div>
                <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 text-center">
                  <p className="text-xs text-zinc-500 mb-1 font-bold uppercase tracking-wide">Deduções de Taxas</p>
                  <p className={`text-2xl font-black ${data.subscriptions.poe.poeTaxas > 0 ? "text-red-400" : "text-zinc-400"}`}>
                    -{formatCurrency(data.subscriptions.poe.poeTaxas)}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {data.subscriptions.poe.poeDeductFees ? `Taxa aplicada: ${data.subscriptions.poe.poeSubscriptionFee}%` : "Sem desconto de taxas"}
                  </p>
                </div>
                <div className="bg-amber-500/10 rounded-xl border border-amber-500/20 p-4 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/50" />
                  <p className="text-xs text-amber-500 mb-1 font-bold uppercase tracking-wide">🏠 Barbearia ({data.subscriptions.poe.poeOwnerPct}%)</p>
                  <p className="text-2xl font-black text-amber-500">{formatCurrency(data.subscriptions.poe.poeBarbearia)}</p>
                  <p className="text-[10px] text-amber-500/70 mt-1">Entra para caixa líquido</p>
                </div>
                <div className="bg-blue-500/10 rounded-xl border border-blue-500/20 p-4 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50" />
                  <p className="text-xs text-blue-400 mb-1 font-bold uppercase tracking-wide">💈 Pool Profissionais ({data.subscriptions.poe.poeBarberPct}%)</p>
                  <p className="text-2xl font-black text-blue-400">{formatCurrency(data.subscriptions.poe.poolBarbeiros)}</p>
                  <p className="text-[10px] text-blue-400/70 mt-1">Dividido por {data.subscriptions.poe.totalServicos} serviços</p>
                </div>
              </div>

              {/* Partilha por Profissional */}
              <div className="bg-white rounded-2xl text-zinc-900 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                      <DollarSign className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500 font-medium">Ticket médio do POE por serviço</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black text-zinc-900">{formatCurrency(data.subscriptions.poe.ticketPorServico)}</p>
                        <p className="text-xs font-bold text-green-600">por atendimento</p>
                      </div>
                    </div>
                  </div>
                </div>

                {data.subscriptions.poe.partilhaBarbeiros.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 text-sm font-medium">
                    Nenhum atendimento de assinante registrado neste período.
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-zinc-100">
                      {data.subscriptions.poe.partilhaBarbeiros.map((b, i) => {
                        const pctDoPool = data.subscriptions.poe.poolBarbeiros > 0 ? (b.recebe / data.subscriptions.poe.poolBarbeiros) * 100 : 0;
                        return (
                          <div key={b.id} className="px-6 py-4 hover:bg-zinc-50/50 transition-colors">
                            <div className="flex items-center gap-4 mb-3">
                              <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                <span className="text-blue-700 font-bold text-xs">{i + 1}º</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-zinc-900">{b.name}</p>
                                  <p className="text-lg font-black text-blue-600">{formatCurrency(b.recebe)}</p>
                                </div>
                                <div className="flex items-center justify-between mt-0.5">
                                  <p className="text-xs text-zinc-500 font-medium">
                                    {b.servicos} serviço{b.servicos !== 1 ? "s" : ""} × {formatCurrency(data.subscriptions.poe.ticketPorServico)}
                                  </p>
                                  <p className="text-xs font-bold text-zinc-400">{pctDoPool.toFixed(1)}% do pool</p>
                                </div>
                              </div>
                            </div>
                            <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${pctDoPool}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-sm">
                      <span className="text-zinc-500 font-medium">Total distribuído da partilha</span>
                      <span className="font-black text-zinc-900">{formatCurrency(data.subscriptions.poe.poolBarbeiros)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Plan Distribution */}
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between lg:col-span-1">
              <div>
                <h3 className="font-bold text-zinc-950 text-base">Distribuição por Plano</h3>
                <p className="text-zinc-400 text-xs mt-0.5">Assinantes and receita por modalidade de plano</p>
                
                {data.subscriptions.planosBreakdown.length === 0 ? (
                  <p className="text-sm text-zinc-400 py-12 text-center">Nenhum plano ativo encontrado.</p>
                ) : (
                  <div className="space-y-4 mt-6">
                    {data.subscriptions.planosBreakdown.map((plan) => {
                      const totalRev = data.subscriptions.mrr || 1;
                      const pctShare = Math.round((plan.total / totalRev) * 100);
                      return (
                        <div key={plan.name} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-zinc-800">{plan.name} <span className="text-zinc-400">({plan.count})</span></span>
                            <span className="font-bold text-zinc-900">{formatCurrency(plan.total)} ({pctShare}%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                            <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${pctShare}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="bg-zinc-50 rounded-xl p-3 text-xs text-zinc-500 flex gap-2 items-start mt-6">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Otimize o marketing de seus planos com menor aderência física ou lance ofertas exclusivas.</span>
              </div>
            </div>

            {/* Billing Logs Table */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-zinc-950 text-base">Histórico de Cobranças Recentes</h3>
                    <p className="text-zinc-400 text-xs mt-0.5">Breakdown detalhado das últimas faturas processadas</p>
                  </div>
                  <span className="text-xs bg-zinc-100 text-zinc-600 px-2.5 py-1 rounded-lg font-bold">
                    {billingLogs.length} total
                  </span>
                </div>

                {billingLogs.length === 0 ? (
                  <div className="py-16 text-center text-zinc-400 text-sm">
                    Nenhuma fatura encontrada neste período.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-zinc-50 text-zinc-500 text-xs font-bold uppercase tracking-wider border-b border-zinc-100">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Cliente</th>
                          <th className="px-6 py-3 font-semibold">Plano</th>
                          <th className="px-6 py-3 font-semibold">Valor</th>
                          <th className="px-6 py-3 font-semibold">Data</th>
                          <th className="px-6 py-3 font-semibold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {currentBillingRows.map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="px-6 py-3.5 font-semibold text-zinc-900">{log.clientName}</td>
                            <td className="px-6 py-3.5 text-zinc-600">{log.planName}</td>
                            <td className="px-6 py-3.5 font-bold text-zinc-950">{formatCurrency(log.amount)}</td>
                            <td className="px-6 py-3.5 text-zinc-500">{formatDate(log.createdAt)}</td>
                            <td className="px-6 py-3.5 text-center">{renderPaymentStatus(log.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Billing Pagination */}
              {totalBillingPages > 1 && (
                <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                  <p className="text-xs text-zinc-400 font-medium">
                    Mostrando {(billingPage - 1) * billingRowsPerPage + 1} a{" "}
                    {Math.min(billingPage * billingRowsPerPage, billingLogs.length)} de {billingLogs.length} logs
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setBillingPage((p) => Math.max(1, p - 1))}
                      disabled={billingPage === 1}
                      className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4 text-zinc-600" />
                    </button>
                    {Array.from({ length: totalBillingPages }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setBillingPage(idx + 1)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors ${
                          billingPage === idx + 1
                            ? "bg-amber-500 border-amber-500 text-white"
                            : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setBillingPage((p) => Math.min(totalBillingPages, p + 1))}
                      disabled={billingPage === totalBillingPages}
                      className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ATENDIMENTOS TAB                                                       */}
      {/* ========================================================================= */}
      {activeTab === "services" && (
        <div className="space-y-6 animate-fadeIn">
          {/* KPIs services */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total de Atendimentos</p>
                <p className="text-3xl font-black text-zinc-950 mt-1">{data.atendimentos.totalServices}</p>
              </div>
              <p className="text-xs text-zinc-400 mt-2">Serviços concluídos no período</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Faturamento Bruto</p>
                <p className="text-3xl font-black text-zinc-950 mt-1">{formatCurrency(data.atendimentos.revenue)}</p>
              </div>
              <p className="text-xs text-zinc-400 mt-2">Volume total (avulso + assinaturas)</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Faturamento Líquido</p>
                <p className="text-3xl font-black text-emerald-600 mt-1">{formatCurrency(data.atendimentos.netRevenue)}</p>
              </div>
              <p className="text-xs text-zinc-400 mt-2">
                Dedução de máquina ({data.atendimentos.debitFee}% D / {data.atendimentos.creditFee}% C)
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Ticket Médio</p>
                <p className="text-3xl font-black text-amber-600 mt-1">{formatCurrency(data.atendimentos.avgTicket)}</p>
              </div>
              <p className="text-xs text-zinc-400 mt-2">Médio por cliente atendido</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Service demand list */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-zinc-100">
                  <h3 className="font-bold text-zinc-950 text-base">Ranking de Serviços mais Realizados</h3>
                  <p className="text-zinc-400 text-xs mt-0.5">Sua grade de serviços ordenados por volume de demanda</p>
                </div>

                {data.atendimentos.serviceRanking.length === 0 ? (
                  <div className="py-16 text-center text-zinc-400 text-sm">
                    Nenhum serviço registrado neste período.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-zinc-50 text-zinc-500 text-xs font-bold uppercase tracking-wider border-b border-zinc-100">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Posição</th>
                          <th className="px-6 py-3 font-semibold">Serviço</th>
                          <th className="px-6 py-3 font-semibold text-center">Demanda (Qtd)</th>
                          <th className="px-6 py-3 font-semibold text-right">Faturamento Bruto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {data.atendimentos.serviceRanking.map((s, idx) => (
                          <tr key={s.name} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="px-6 py-3.5 font-bold text-zinc-500">
                              {idx === 0 ? "🥇 1º" : idx === 1 ? "🥈 2º" : idx === 2 ? "🥉 3º" : `${idx + 1}º`}
                            </td>
                            <td className="px-6 py-3.5 font-semibold text-zinc-900">{s.name}</td>
                            <td className="px-6 py-3.5 text-center text-zinc-700">{s.count} vezes</td>
                            <td className="px-6 py-3.5 font-bold text-zinc-950 text-right">{formatCurrency(s.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Barber performance share */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-zinc-100">
                  <h3 className="font-bold text-zinc-950 text-base">Faturamento Share — Barbeiros</h3>
                  <p className="text-zinc-400 text-xs mt-0.5">Produção e volume de repasse comissional por barbeiro</p>
                </div>

                {data.atendimentos.barberPerformance.length === 0 ? (
                  <div className="py-16 text-center text-zinc-400 text-sm">
                    Nenhum profissional gerou faturamento neste período.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-zinc-50 text-zinc-500 text-xs font-bold uppercase tracking-wider border-b border-zinc-100">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Profissional</th>
                          <th className="px-6 py-3 font-semibold text-center">Atendimentos</th>
                          <th className="px-6 py-3 font-semibold text-right">Faturamento Share</th>
                          <th className="px-6 py-3 font-semibold text-right">Comissão Estimada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {data.atendimentos.barberPerformance.map((b) => (
                          <tr key={b.name} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="px-6 py-3.5">
                              <p className="font-semibold text-zinc-900">{b.name}</p>
                              {b.nickname && <span className="text-xs text-zinc-400">({b.nickname})</span>}
                            </td>
                            <td className="px-6 py-3.5 text-center text-zinc-700 font-medium">{b.count} serviços</td>
                            <td className="px-6 py-3.5 font-black text-zinc-950 text-right">{formatCurrency(b.gross)}</td>
                            <td className="px-6 py-3.5 font-bold text-blue-600 text-right">{formatCurrency(b.commission)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CLIENTES TAB                                                           */}
      {/* ========================================================================= */}
      {activeTab === "clients" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Cohorts info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Retenção de Recorrentes</p>
                <p className="text-3xl font-black text-zinc-950 mt-1">{data.clientes.cohort.recurrent}</p>
              </div>
              <p className="text-xs text-zinc-400 mt-2">Clientes antigos que retornaram no período</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Atração de Clientes Novos</p>
                <p className="text-3xl font-black text-amber-600 mt-1">+{data.clientes.cohort.new}</p>
              </div>
              <p className="text-xs text-zinc-400 mt-2">Primeira visita registrada no período</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total de Atendidos</p>
                <p className="text-3xl font-black text-emerald-600 mt-1">
                  {data.clientes.cohort.new + data.clientes.cohort.recurrent}
                </p>
              </div>
              <p className="text-xs text-zinc-400 mt-2">Clientes ativos totais no período de datas</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Customers list */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-zinc-100">
                  <h3 className="font-bold text-zinc-950 text-base">Top Clientes — Faturamento Líder</h3>
                  <p className="text-zinc-400 text-xs mt-0.5">Leaderboard dos clientes que mais investiram na sua barbearia</p>
                </div>

                {clientRanking.length === 0 ? (
                  <div className="py-16 text-center text-zinc-400 text-sm">
                    Nenhum cliente registrado neste período.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-zinc-50 text-zinc-500 text-xs font-bold uppercase tracking-wider border-b border-zinc-100">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Rank</th>
                          <th className="px-6 py-3 font-semibold">Cliente</th>
                          <th className="px-6 py-3 font-semibold text-center">Visitas (Qtd)</th>
                          <th className="px-6 py-3 font-semibold text-right">Faturamento Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {currentClientRankRows.map((c, idx) => {
                          const rank = (clientRankPage - 1) * clientRankRowsPerPage + idx + 1;
                          return (
                            <tr key={c.name} className="hover:bg-zinc-50/50 transition-colors">
                              <td className="px-6 py-3.5 font-bold">
                                {rank === 1 ? "🥇 1º" : rank === 2 ? "🥈 2º" : rank === 3 ? "🥉 3º" : `${rank}º`}
                              </td>
                              <td className="px-6 py-3.5">
                                <p className="font-semibold text-zinc-900">{c.name}</p>
                                {c.phone && <span className="text-xs text-zinc-400">{c.phone}</span>}
                              </td>
                              <td className="px-6 py-3.5 text-center text-zinc-700 font-medium">{c.visits} visitas</td>
                              <td className="px-6 py-3.5 font-black text-zinc-950 text-right">{formatCurrency(c.totalSpent)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Top Customers Pagination */}
              {totalClientRankPages > 1 && (
                <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                  <p className="text-xs text-zinc-400 font-medium">
                    Mostrando {(clientRankPage - 1) * clientRankRowsPerPage + 1} a{" "}
                    {Math.min(clientRankPage * clientRankRowsPerPage, clientRanking.length)} de {clientRanking.length} clientes
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setClientRankPage((p) => Math.max(1, p - 1))}
                      disabled={clientRankPage === 1}
                      className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4 text-zinc-600" />
                    </button>
                    {Array.from({ length: totalClientRankPages }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setClientRankPage(idx + 1)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors ${
                          clientRankPage === idx + 1
                            ? "bg-amber-500 border-amber-500 text-white"
                            : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setClientRankPage((p) => Math.min(totalClientRankPages, p + 1))}
                      disabled={clientRankPage === totalClientRankPages}
                      className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Inactive clients risk table & win-back WhatsApp triggers */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-zinc-950 text-base text-red-650 flex items-center gap-1.5">
                      <BadgeAlert className="w-4.5 h-4.5 text-red-500 animate-pulse" />
                      Clientes em Risco (Inativos +45 dias)
                    </h3>
                    <p className="text-zinc-400 text-xs mt-0.5">Recupere clientes antigos enviando convites personalizados</p>
                  </div>
                  <span className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-lg font-bold">
                    {riskList.length} em risco
                  </span>
                </div>

                {riskList.length === 0 ? (
                  <div className="py-16 text-center text-zinc-400 text-sm">
                    Parabéns! Nenhum cliente inativo detectado nas regras de atrito.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-zinc-50 text-zinc-500 text-xs font-bold uppercase tracking-wider border-b border-zinc-100">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Cliente</th>
                          <th className="px-6 py-3 font-semibold">Última Visita</th>
                          <th className="px-6 py-3 font-semibold text-center">Tempo Inativo</th>
                          <th className="px-6 py-3 font-semibold text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {currentRiskRows.map((c) => {
                          const wppMsg = encodeURIComponent(
                            `Olá, ${c.name}! Sentimos sua falta aqui no BarberApp. Que tal agendar um horário para dar aquele trato no visual esta semana? Esperamos você!`
                          );
                          const wppLink = `https://wa.me/${c.phone?.replace(/\D/g, "")}?text=${wppMsg}`;

                          return (
                            <tr key={c.id} className="hover:bg-red-50/10 transition-colors">
                              <td className="px-6 py-3.5 font-semibold text-zinc-900">{c.name}</td>
                              <td className="px-6 py-3.5 text-zinc-500">{formatDate(c.lastVisit)}</td>
                              <td className="px-6 py-3.5 text-center">
                                <span className="inline-flex items-center bg-red-50 text-red-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                  {c.daysSince} dias
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                {c.phone ? (
                                  <a
                                    href={wppLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-all"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    Acionar
                                  </a>
                                ) : (
                                  <span className="text-zinc-300 text-xs font-medium">Sem WhatsApp</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Risk List Pagination */}
              {totalRiskPages > 1 && (
                <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                  <p className="text-xs text-zinc-400 font-medium">
                    Mostrando {(riskPage - 1) * riskRowsPerPage + 1} a{" "}
                    {Math.min(riskPage * riskRowsPerPage, riskList.length)} de {riskList.length} em risco
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setRiskPage((p) => Math.max(1, p - 1))}
                      disabled={riskPage === 1}
                      className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4 text-zinc-600" />
                    </button>
                    {Array.from({ length: totalRiskPages }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setRiskPage(idx + 1)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors ${
                          riskPage === idx + 1
                            ? "bg-amber-500 border-amber-500 text-white"
                            : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setRiskPage((p) => Math.min(totalRiskPages, p + 1))}
                      disabled={riskPage === totalRiskPages}
                      className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PREVISÃO DE RECEITA TAB                                                */}
      {/* ========================================================================= */}
      {activeTab === "forecast" && (
        <div className="space-y-6 animate-fadeIn">
          {forecastLoading || !forecast ? (
            <div className="flex items-center justify-center py-32">
              <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Aviso metodologia */}
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  Projeção baseada em: <strong>MRR das assinaturas ativas</strong> +{" "}
                  <strong>média mensal de serviços</strong> dos últimos{" "}
                  {forecast.breakdown.historicalMonths} mês(es) registrado(s), descontando{" "}
                  <strong>despesas fixas e variáveis</strong> recorrentes.
                </p>
              </div>

              {/* Cards 30 / 60 / 90 dias */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {forecast.periods.map((p) => {
                  const isPositive = p.net >= 0;
                  return (
                    <div key={p.days} className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                      <div className={`px-5 py-3 flex items-center justify-between ${p.days === 30 ? "bg-emerald-50" : p.days === 60 ? "bg-blue-50" : "bg-violet-50"}`}>
                        <span className={`text-xs font-bold uppercase tracking-wider ${p.days === 30 ? "text-emerald-600" : p.days === 60 ? "text-blue-600" : "text-violet-600"}`}>
                          Próximos {p.label}
                        </span>
                        {isPositive
                          ? <TrendingUp className={`w-4 h-4 ${p.days === 30 ? "text-emerald-500" : p.days === 60 ? "text-blue-500" : "text-violet-500"}`} />
                          : <TrendingDown className="w-4 h-4 text-red-500" />}
                      </div>
                      <div className="p-5 space-y-4">
                        <div>
                          <p className="text-xs text-zinc-400 font-medium mb-0.5">Receita Projetada</p>
                          <p className="text-2xl font-black text-zinc-950">{formatCurrency(p.revenue)}</p>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between text-zinc-500">
                            <span>Assinaturas (MRR × {p.days / 30})</span>
                            <span className="font-semibold text-zinc-700">{formatCurrency(p.mrrPortion)}</span>
                          </div>
                          <div className="flex justify-between text-zinc-500">
                            <span>Serviços avulsos</span>
                            <span className="font-semibold text-zinc-700">{formatCurrency(p.servicesPortion)}</span>
                          </div>
                          <div className="border-t border-zinc-100 pt-2 flex justify-between text-zinc-500">
                            <span>Despesas estimadas</span>
                            <span className="font-semibold text-red-500">- {formatCurrency(p.expenses)}</span>
                          </div>
                        </div>
                        <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${isPositive ? "bg-emerald-50" : "bg-red-50"}`}>
                          <span className={`text-xs font-bold ${isPositive ? "text-emerald-700" : "text-red-700"}`}>Saldo líquido</span>
                          <span className={`text-lg font-black ${isPositive ? "text-emerald-700" : "text-red-700"}`}>
                            {isPositive ? "+" : ""}{formatCurrency(p.net)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Breakdown das bases de cálculo */}
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
                <h3 className="font-bold text-zinc-950 text-base mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-500" />
                  Bases de Cálculo
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-zinc-50 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-medium mb-1">MRR Atual</p>
                    <p className="text-xl font-black text-zinc-900">{formatCurrency(forecast.breakdown.monthlyMRR)}</p>
                    <p className="text-[11px] text-zinc-400 mt-1">{forecast.breakdown.activeSubscriptions} assinatura(s) ativa(s)</p>
                  </div>
                  <div className="bg-zinc-50 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-medium mb-1">Serviços / Mês</p>
                    <p className="text-xl font-black text-zinc-900">{formatCurrency(forecast.breakdown.avgMonthlyServices)}</p>
                    <p className="text-[11px] text-zinc-400 mt-1">Média dos últimos {forecast.breakdown.historicalMonths} mês(es)</p>
                  </div>
                  <div className="bg-zinc-50 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-medium mb-1">Despesas Fixas</p>
                    <p className="text-xl font-black text-red-600">{formatCurrency(forecast.breakdown.monthlyFixedExpenses)}</p>
                    <p className="text-[11px] text-zinc-400 mt-1">Despesas recorrentes mensais</p>
                  </div>
                  <div className="bg-zinc-50 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 font-medium mb-1">Despesas Variáveis</p>
                    <p className="text-xl font-black text-red-600">{formatCurrency(forecast.breakdown.avgMonthlyVarExpenses)}</p>
                    <p className="text-[11px] text-zinc-400 mt-1">Média dos últimos 3 meses</p>
                  </div>
                </div>
              </div>

              {/* Aviso dados insuficientes */}
              {forecast.breakdown.historicalMonths < 3 && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">
                    Apenas <strong>{forecast.breakdown.historicalMonths}</strong> mês(es) de histórico disponível.
                    A previsão ficará mais precisa com o tempo — idealmente 3+ meses de dados.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
