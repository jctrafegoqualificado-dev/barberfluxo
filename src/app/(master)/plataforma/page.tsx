"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp, Users, ShoppingBag, Activity, Store, ArrowUpRight,
  Crown, ShieldCheck, ShieldAlert, Search, Download, BadgeDollarSign,
  BarChart3, UserPlus, UserMinus, Percent, Shield, Trash2, Mail,
  CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw
} from "lucide-react";

type TabType = "analytics" | "assinantes" | "pagamentos" | "equipe" | "infraestrutura";

type CronJob = {
  name: string;
  label: string;
  status: "ok" | "error" | "stale" | "never";
  lastRun: string | null;
  durationMs: number | null;
  result: Record<string, unknown> | null;
};

export default function PlataformaDashboard() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("analytics");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Infraestrutura
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [cronLoading, setCronLoading] = useState(false);

  // Equipe
  const [team, setTeam] = useState<{ id: string; name: string; email: string; role: string; isPlatformAdmin: boolean; createdAt: string }[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [teamError, setTeamError] = useState("");
  const [teamSuccess, setTeamSuccess] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/plataforma/stats", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setStats(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  async function loadTeam() {
    setTeamLoading(true);
    try {
      const res = await fetch("/api/plataforma/team", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTeam(data.admins || []);
    } catch (e) {
      console.error(e);
    } finally {
      setTeamLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "equipe" && token) loadTeam();
  }, [activeTab, token]);

  async function loadCronHealth() {
    setCronLoading(true);
    try {
      const res = await fetch("/api/plataforma/cron-health", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCronJobs(data.jobs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setCronLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "infraestrutura" && token) loadCronHealth();
  }, [activeTab, token]);

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    setTeamError("");
    setTeamSuccess("");
    setAddingAdmin(true);
    try {
      const res = await fetch("/api/plataforma/team", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newAdminEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTeamSuccess(data.message);
      setNewAdminEmail("");
      await loadTeam();
    } catch (e: any) {
      setTeamError(e.message);
    } finally {
      setAddingAdmin(false);
    }
  }

  async function removeAdmin(id: string, name: string) {
    if (!confirm(`Remover acesso de "${name}" ao /plataforma?`)) return;
    setActionLoading(`team-${id}`);
    try {
      const res = await fetch(`/api/plataforma/team/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTeamSuccess(data.message);
      await loadTeam();
    } catch (e: any) {
      setTeamError(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function changePlan(id: string, newPlan: string) {
    if (!confirm(`Alterar plano para ${newPlan}?`)) return;
    setActionLoading(`plan-${id}`);
    try {
      await fetch(`/api/plataforma/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ saasPlan: newPlan })
      });
      // Reload stats
      const res = await fetch("/api/plataforma/stats", { headers: { Authorization: `Bearer ${token}` } });
      setStats(await res.json());
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    setActionLoading(`status-${id}`);
    try {
      await fetch(`/api/plataforma/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !currentStatus })
      });
      const res = await fetch("/api/plataforma/stats", { headers: { Authorization: `Bearer ${token}` } });
      setStats(await res.json());
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!stats) return null;

  // Filter shops for Assinantes tab
  const filteredShops = (stats.shops || []).filter((s: any) => {
    const matchSearch = searchTerm === "" ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.owner?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.slug?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPlan = filterPlan === "ALL" || s.saasPlan === filterPlan;
    const matchStatus = filterStatus === "ALL" ||
      (filterStatus === "ACTIVE" && s.active) ||
      (filterStatus === "INACTIVE" && !s.active);
    return matchSearch && matchPlan && matchStatus;
  });

  const maxGrowth = Math.max(...(stats.weeklyGrowth || []).map((w: any) => Math.max(w.newUsers, w.churned)), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Painel Administrativo</h1>
        <p className="text-zinc-400 mt-1">Gerencie assinantes, licenças e monitore métricas</p>
      </div>

      {/* Top KPIs (always visible) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-zinc-400">Total de Assinantes</p>
            <Users className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </div>
          <h2 className="text-3xl font-black text-white mt-2">{stats.totalShops}</h2>
          <p className="text-xs text-emerald-400 mt-1">+{stats.newLast7Days} nos últimos 7 dias</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-zinc-400">MRR</p>
            <BadgeDollarSign className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </div>
          <h2 className="text-3xl font-black text-white mt-2">{formatCurrency(stats.mrr)}</h2>
          <p className="text-xs text-zinc-500 mt-1">Receita mensal recorrente</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-zinc-400">Taxa de Conversão</p>
            <ArrowUpRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </div>
          <h2 className="text-3xl font-black text-white mt-2">{stats.conversionRate}%</h2>
          <p className="text-xs text-zinc-500 mt-1">{(stats.planDistribution.pro || 0) + (stats.planDistribution.elite || 0)} assinantes pagos</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-zinc-400">Distribuição de Planos</p>
            <Crown className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="text-zinc-300">Basic: <strong className="text-white">{stats.planDistribution.basic}</strong></span>
            <span className="text-amber-400">PRO: <strong>{stats.planDistribution.pro || 0}</strong></span>
            <span className="text-violet-400">ELITE: <strong>{stats.planDistribution.elite || 0}</strong></span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <div className="flex gap-1">
          {([
            { id: "analytics", label: "Analytics" },
            { id: "assinantes", label: "Assinantes" },
            { id: "pagamentos", label: "Pagamentos" },
            { id: "equipe", label: "Equipe" },
            { id: "infraestrutura", label: "Infraestrutura" },
          ] as { id: TabType; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "text-white border-indigo-500"
                  : "text-zinc-400 border-transparent hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== ANALYTICS TAB ===== */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Secondary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex justify-between items-start">
                <p className="text-sm font-medium text-zinc-400">Assinantes Ativos</p>
                <ShieldCheck className="w-5 h-5 text-emerald-500/50" />
              </div>
              <h2 className="text-2xl font-black text-white mt-2">{stats.activeShops}</h2>
              <p className="text-xs text-zinc-500 mt-1">Com acesso ao sistema</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex justify-between items-start">
                <p className="text-sm font-medium text-zinc-400">Novos Assinantes (30d)</p>
                <UserPlus className="w-5 h-5 text-indigo-500/50" />
              </div>
              <h2 className="text-2xl font-black text-white mt-2">{stats.newLast30Days}</h2>
              <p className="text-xs text-zinc-500 mt-1">Cadastros recentes</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex justify-between items-start">
                <p className="text-sm font-medium text-zinc-400">Receita SaaS (Mês)</p>
                <ShoppingBag className="w-5 h-5 text-amber-500/50" />
              </div>
              <h2 className="text-2xl font-black text-white mt-2">{formatCurrency(stats.saasRevenueThisMonth)}</h2>
              <p className="text-xs text-zinc-500 mt-1">Pagamentos confirmados</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex justify-between items-start">
                <p className="text-sm font-medium text-zinc-400">Taxa de Churn</p>
                <UserMinus className="w-5 h-5 text-rose-500/50" />
              </div>
              <h2 className="text-2xl font-black text-white mt-2">{stats.churnRate}%</h2>
              <p className="text-xs text-zinc-500 mt-1">Perda de ativos (últimos 30d)</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Distribuição de Planos - Donut Chart */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-1">Distribuição de Planos</h3>
              <p className="text-sm text-zinc-500 mb-6">Proporção entre planos ativos</p>
              <div className="flex items-center justify-center gap-8">
                <div className="relative w-40 h-40">
                  <svg viewBox="0 0 36 36" className="w-40 h-40 transform -rotate-90">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#27272a" strokeWidth="4" />
                    {stats.totalShops > 0 && (
                      <>
                        <circle
                          cx="18" cy="18" r="14" fill="none"
                          stroke="#818cf8" strokeWidth="4"
                          strokeDasharray={`${((stats.planDistribution.elite || 0) / stats.totalShops) * 88} 88`}
                          strokeLinecap="round"
                        />
                        <circle
                          cx="18" cy="18" r="14" fill="none"
                          stroke="#6ee7b7" strokeWidth="4"
                          strokeDasharray={`${(stats.planDistribution.basic / stats.totalShops) * 88} 88`}
                          strokeDashoffset={`-${((stats.planDistribution.elite || 0) / stats.totalShops) * 88}`}
                          strokeLinecap="round"
                        />
                      </>
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{stats.totalShops}</span>
                    <span className="text-[10px] text-zinc-500">Total</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-violet-400" />
                    <span className="text-sm text-zinc-300">ELITE <strong className="text-white">{stats.planDistribution.elite || 0}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="text-sm text-zinc-300">PRO <strong className="text-white">{stats.planDistribution.pro || 0}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-300" />
                    <span className="text-sm text-zinc-300">Basic <strong className="text-white">{stats.planDistribution.basic}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-zinc-700" />
                    <span className="text-sm text-zinc-300">Inativos <strong className="text-white">{stats.inactiveShops}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Crescimento Líquido - Bar Chart */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-1">Crescimento Líquido (8 Semanas)</h3>
              <p className="text-sm text-zinc-500 mb-6">Fluxo de entrada vs saída de licenças</p>
              <div className="flex items-end gap-2 h-40">
                {(stats.weeklyGrowth || []).map((w: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col items-center justify-end h-28 gap-0.5">
                      <div
                        className="w-full bg-emerald-500 rounded-t-sm transition-all"
                        style={{ height: `${maxGrowth > 0 ? (w.newUsers / maxGrowth) * 100 : 0}%`, minHeight: w.newUsers > 0 ? '4px' : '0' }}
                        title={`Novos: ${w.newUsers}`}
                      />
                      {w.churned > 0 && (
                        <div
                          className="w-full bg-rose-500 rounded-b-sm"
                          style={{ height: `${(w.churned / maxGrowth) * 100}%`, minHeight: '4px' }}
                          title={`Cancelados: ${w.churned}`}
                        />
                      )}
                    </div>
                    <span className="text-[9px] text-zinc-500">{w.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" /> Novos</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-rose-500 rounded-sm" /> Cancelados</div>
              </div>
            </div>
          </div>

          {/* Growth insight */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
            <p className="text-sm text-zinc-400">
              Este gráfico ajuda a visualizar o <strong className="text-white">Net Growth</strong>. Se as barras vermelhas (cancelamentos) estiverem maiores que as verdes, considere campanhas de reativação ou revisão do valor percebido do plano.
            </p>
          </div>
        </div>
      )}

      {/* ===== ASSINANTES TAB ===== */}
      {activeTab === "assinantes" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-white">Gestão de Assinantes</h2>
            <p className="text-sm text-zinc-500">Visualize e gerencie licenças dos assinantes ({filteredShops.length} encontrados)</p>
          </div>

          {/* Search + Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent text-white text-sm placeholder-zinc-500 outline-none flex-1"
              />
            </div>
            <select
              value={filterPlan}
              onChange={e => setFilterPlan(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium rounded-lg px-3 py-2 outline-none appearance-none cursor-pointer"
            >
              <option value="ALL">Todos Planos</option>
              <option value="BASIC">Basic</option>
              <option value="PRO">PRO</option>
              <option value="ELITE">ELITE</option>
              <option value="PREMIUM">Premium (legado)</option>
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium rounded-lg px-3 py-2 outline-none appearance-none cursor-pointer"
            >
              <option value="ALL">Todos Status</option>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Bloqueado</option>
            </select>
            <button
              onClick={() => {
                const csv = ["Barbearia,Email,Plano,Status,Criado Em"]
                  .concat(filteredShops.map((s: any) =>
                    `"${s.name}","${s.owner?.email || ''}","${s.saasPlan}","${s.active ? 'Ativo' : 'Bloqueado'}","${new Date(s.createdAt).toLocaleDateString('pt-BR')}"`
                  )).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `assinantes_${new Date().toISOString().split("T")[0]}.csv`;
                a.click();
              }}
              className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium rounded-lg px-3 py-2 hover:bg-zinc-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
          </div>

          {/* Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-sm font-semibold text-zinc-400 bg-zinc-950/50">
                  <th className="p-4">Barbearia</th>
                  <th className="p-4">Assinante Desde</th>
                  <th className="p-4">Plano</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-sm">
                {filteredShops.map((shop: any) => (
                  <tr key={shop.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                          <Store className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-white">{shop.name}</p>
                          <p className="text-xs text-zinc-500">{shop.owner?.email || shop.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-zinc-400">
                      {new Date(shop.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4">
                      <select
                        value={shop.saasPlan}
                        onChange={(e) => changePlan(shop.id, e.target.value)}
                        disabled={actionLoading === `plan-${shop.id}`}
                        className={`px-3 py-1 text-xs font-bold rounded-xl transition-colors appearance-none cursor-pointer outline-none border-0 ${
                          shop.saasPlan === "ELITE" || shop.saasPlan === "PREMIUM"
                            ? "bg-violet-500/20 text-violet-400"
                            : shop.saasPlan === "PRO"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        <option value="BASIC">BASIC</option>
                        <option value="PRO">PRO</option>
                        <option value="ELITE">ELITE</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleStatus(shop.id, shop.active)}
                        disabled={actionLoading === `status-${shop.id}`}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                          shop.active
                            ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        }`}
                      >
                        {shop.active ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                        {shop.active ? "Ativo" : "Bloqueado"}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/plataforma/clientes/${shop.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                      >
                        Gerenciar 💳
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredShops.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-zinc-500">Nenhum assinante encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== EQUIPE TAB ===== */}
      {activeTab === "equipe" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">Equipe de Administradores</h2>
            <p className="text-sm text-zinc-500">Gerencie quem tem acesso ao painel da plataforma</p>
          </div>

          {/* Formulário para adicionar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-400" />
              Dar acesso a novo administrador
            </h3>
            <form onSubmit={addAdmin} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-zinc-500 mb-1.5">E-mail da conta</label>
                <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5">
                  <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={e => { setNewAdminEmail(e.target.value); setTeamError(""); setTeamSuccess(""); }}
                    placeholder="email@exemplo.com"
                    className="bg-transparent text-white text-sm placeholder-zinc-500 outline-none flex-1"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={addingAdmin}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {addingAdmin ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Dar Acesso
              </button>
            </form>

            {teamError && (
              <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                {teamError}
              </div>
            )}
            {teamSuccess && (
              <div className="mt-3 flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-400">
                ✅ {teamSuccess}
              </div>
            )}

            <p className="text-xs text-zinc-600 mt-3">
              O usuário precisa ter uma conta criada em{" "}
              <span className="text-zinc-400 font-mono">/cadastro</span> antes de receber acesso.
            </p>
          </div>

          {/* Lista de admins */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-zinc-300">Administradores ativos ({team.length})</span>
            </div>

            {teamLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : team.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-sm">Nenhum administrador encontrado.</div>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {team.map(admin => (
                  <li key={admin.id} className="flex items-center justify-between px-6 py-4 hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
                        {admin.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{admin.name || "—"}</p>
                        <p className="text-xs text-zinc-500">{admin.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-600">
                        desde {new Date(admin.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                      {admin.role === "PLATFORM_ADMIN" ? (
                        <span className="text-xs font-bold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full">
                          Super Admin
                        </span>
                      ) : (
                        <span className="text-xs font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full">
                          Admin + Dono
                        </span>
                      )}
                      <button
                        onClick={() => removeAdmin(admin.id, admin.name || admin.email)}
                        disabled={actionLoading === `team-${admin.id}`}
                        title="Remover acesso"
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ===== PAGAMENTOS TAB ===== */}
      {activeTab === "pagamentos" && (
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-xl font-bold text-white">Histórico de Pagamentos SaaS</h2>
              <p className="text-sm text-zinc-500">Todos os pagamentos de mensalidade recebidos</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500">Receita total acumulada</p>
              <p className="text-2xl font-black text-emerald-400">{formatCurrency(stats.saasRevenueTotal)}</p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-sm font-semibold text-zinc-400 bg-zinc-950/50">
                  <th className="p-4">Data</th>
                  <th className="p-4">Barbearia</th>
                  <th className="p-4">Valor</th>
                  <th className="p-4">Método</th>
                  <th className="p-4">Origem</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-sm">
                {(stats.saasPayments || []).map((p: any) => (
                  <tr key={p.id} className="hover:bg-zinc-800/30">
                    <td className="p-4 text-zinc-300">
                      {new Date(p.createdAt).toLocaleDateString('pt-BR')} {new Date(p.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4 text-white font-medium">{p.barbershop?.name || "—"}</td>
                    <td className="p-4 font-bold text-white">{formatCurrency(p.amount)}</td>
                    <td className="p-4 text-zinc-400">{p.method}</td>
                    <td className="p-4">
                      {p.externalId
                        ? <span className="text-indigo-400 text-xs font-bold bg-indigo-400/10 px-2 py-0.5 rounded-full">Mercado Pago</span>
                        : <span className="text-zinc-400 text-xs font-bold bg-zinc-800 px-2 py-0.5 rounded-full">Manual</span>
                      }
                    </td>
                    <td className="p-4">
                      {p.status === "PAID" ?
                        <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full text-xs font-bold">PAGO</span> :
                        p.status === "PENDING" ?
                        <span className="text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full text-xs font-bold">PENDENTE</span> :
                        <span className="text-red-400 bg-red-400/10 px-2 py-1 rounded-full text-xs font-bold">{p.status}</span>
                      }
                    </td>
                  </tr>
                ))}
                {(!stats.saasPayments || stats.saasPayments.length === 0) && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-zinc-500">Nenhum pagamento registrado ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ===== INFRAESTRUTURA TAB ===== */}
      {activeTab === "infraestrutura" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Saúde dos Jobs Automáticos</h2>
              <p className="text-sm text-zinc-500">Monitore o último run de cada cron job</p>
            </div>
            <button
              onClick={loadCronHealth}
              disabled={cronLoading}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${cronLoading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>

          {cronLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-sm font-semibold text-zinc-400 bg-zinc-950/50">
                    <th className="p-4">Job</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Último Run</th>
                    <th className="p-4">Duração</th>
                    <th className="p-4">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-sm">
                  {cronJobs.map((job) => (
                    <tr key={job.name} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="p-4">
                        <p className="font-semibold text-white">{job.label}</p>
                        <p className="text-xs text-zinc-600 font-mono">{job.name}</p>
                      </td>
                      <td className="p-4">
                        {job.status === "ok" && (
                          <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                            <CheckCircle2 className="w-4 h-4" /> OK
                          </span>
                        )}
                        {job.status === "error" && (
                          <span className="flex items-center gap-1.5 text-red-400 text-xs font-bold">
                            <XCircle className="w-4 h-4" /> ERRO
                          </span>
                        )}
                        {job.status === "stale" && (
                          <span className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                            <AlertCircle className="w-4 h-4" /> ATRASADO
                          </span>
                        )}
                        {job.status === "never" && (
                          <span className="flex items-center gap-1.5 text-zinc-500 text-xs font-bold">
                            <Clock className="w-4 h-4" /> NUNCA RODOU
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-zinc-400">
                        {job.lastRun
                          ? new Date(job.lastRun).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
                          : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="p-4 text-zinc-400">
                        {job.durationMs != null
                          ? `${(job.durationMs / 1000).toFixed(1)}s`
                          : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="p-4 text-zinc-500 text-xs font-mono max-w-xs truncate">
                        {job.result
                          ? Object.entries(job.result)
                              .filter(([k]) => k !== "error" || job.status === "error")
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")
                          : <span className="text-zinc-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
