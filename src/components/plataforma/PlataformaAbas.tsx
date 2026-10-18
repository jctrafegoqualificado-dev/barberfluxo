"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import { UserPlus, Shield, Trash2, Mail, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";

type SaasPlanRow = {
  key: string;
  label: string;
  tagline: string;
  monthlyPrice: number;
  annualPriceMonthly: number | null;
  includedBarbers: number;
  extraBarberMonthly: number;
  extraBarberAnnualMonthly: number | null;
  isPaid: boolean;
  legacy: boolean;
  active: boolean;
};

type CronJob = {
  name: string;
  label: string;
  status: "ok" | "error" | "stale" | "never";
  lastRun: string | null;
  durationMs: number | null;
  result: Record<string, unknown> | null;
};

export type AbaPlataforma = "pagamentos" | "planos" | "equipe" | "infraestrutura";

/**
 * Abas de administração da plataforma (Pagamentos, Planos e preços, Equipe, Automações).
 * Vieram da tela antiga /plataforma; a lógica é a mesma, só o visual mudou.
 */
export default function PlataformaAbas({ tab: activeTab }: { tab: AbaPlataforma }) {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Infraestrutura
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [cronLoading, setCronLoading] = useState(false);

  // Planos
  const [plans, setPlans] = useState<SaasPlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planDrafts, setPlanDrafts] = useState<Record<string, SaasPlanRow>>({});
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [planMsg, setPlanMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  async function loadPlans() {
    setPlansLoading(true);
    try {
      const res = await fetch("/api/plataforma/plans", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Falha ao carregar planos");
      const data = await res.json();
      const rows: SaasPlanRow[] = data.plans || [];
      setPlans(rows);
      setPlanDrafts(Object.fromEntries(rows.map((p) => [p.key, { ...p }])));
    } catch (e: any) {
      setPlanMsg({ type: "error", text: e.message || "Erro ao carregar planos" });
    } finally {
      setPlansLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "planos" && token) loadPlans();
  }, [activeTab, token]);

  function setDraft(key: string, field: keyof SaasPlanRow, value: unknown) {
    setPlanDrafts((d) => ({ ...d, [key]: { ...d[key], [field]: value } }));
  }

  async function savePlan(key: string) {
    const draft = planDrafts[key];
    if (!draft) return;
    setPlanMsg(null);
    setSavingPlan(key);
    try {
      const res = await fetch("/api/plataforma/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          key,
          label: draft.label,
          tagline: draft.tagline,
          monthlyPrice: Number(draft.monthlyPrice),
          annualPriceMonthly:
            draft.annualPriceMonthly === null || draft.annualPriceMonthly === undefined
              ? null
              : Number(draft.annualPriceMonthly),
          includedBarbers: Number(draft.includedBarbers ?? 0),
          extraBarberMonthly: Number(draft.extraBarberMonthly ?? 0),
          extraBarberAnnualMonthly:
            draft.extraBarberAnnualMonthly === null || draft.extraBarberAnnualMonthly === undefined || (draft.extraBarberAnnualMonthly as unknown) === ""
              ? null
              : Number(draft.extraBarberAnnualMonthly),
          isPaid: draft.isPaid,
          legacy: draft.legacy,
          active: draft.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar");
      setPlanMsg({ type: "success", text: `Plano ${key} atualizado.` });
      await loadPlans();
    } catch (e: any) {
      setPlanMsg({ type: "error", text: e.message || "Erro ao salvar plano" });
    } finally {
      setSavingPlan(null);
    }
  }

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


  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin" /></div>;
  if (!stats) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* ===== EQUIPE TAB ===== */}
      {activeTab === "equipe" && (
        <div className="space-y-6">
          <div>
            <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Equipe da plataforma</h1>
            <p className="text-sm text-ink-3">Gerencie quem tem acesso ao painel da plataforma</p>
          </div>

          {/* Formulário para adicionar */}
          <div className="bg-surface border border-line rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-ink-2 mb-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-ink" />
              Dar acesso a novo administrador
            </h3>
            <form onSubmit={addAdmin} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-ink-3 mb-1.5">E-mail da conta</label>
                <div className="flex items-center gap-2 bg-surface-2 border border-control rounded-xl px-3 py-2.5">
                  <Mail className="w-4 h-4 text-ink-3 shrink-0" />
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={e => { setNewAdminEmail(e.target.value); setTeamError(""); setTeamSuccess(""); }}
                    placeholder="email@exemplo.com"
                    className="bg-transparent text-ink text-sm placeholder:text-ink-4 outline-none flex-1"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={addingAdmin}
                className="flex items-center gap-2 px-5 py-2.5 bg-ink hover:bg-ink/90 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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
              <div className="mt-3 flex items-start gap-2 bg-danger-soft border border-danger/20 rounded-xl px-4 py-3 text-sm text-danger">
                {teamError}
              </div>
            )}
            {teamSuccess && (
              <div className="mt-3 flex items-start gap-2 bg-positive-soft border border-positive/20 rounded-xl px-4 py-3 text-sm text-positive">
                ✅ {teamSuccess}
              </div>
            )}

            <p className="text-xs text-ink-4 mt-3">
              O usuário precisa ter uma conta criada em{" "}
              <span className="text-ink-3 font-mono">/cadastro</span> antes de receber acesso.
            </p>
          </div>

          {/* Lista de admins */}
          <div className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center gap-2">
              <Shield className="w-4 h-4 text-ink" />
              <span className="text-sm font-semibold text-ink-2">Administradores ativos ({team.length})</span>
            </div>

            {teamLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-ink border-t-transparent rounded-full animate-spin" />
              </div>
            ) : team.length === 0 ? (
              <div className="py-12 text-center text-ink-3 text-sm">Nenhum administrador encontrado.</div>
            ) : (
              <ul className="divide-y divide-line-2">
                {team.map(admin => (
                  <li key={admin.id} className="flex items-center justify-between px-6 py-4 hover:bg-ground transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-ink font-bold text-sm">
                        {admin.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">{admin.name || "—"}</p>
                        <p className="text-xs text-ink-3">{admin.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-ink-4">
                        desde {new Date(admin.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                      {admin.role === "PLATFORM_ADMIN" ? (
                        <span className="text-xs font-bold bg-surface-2 text-ink px-2 py-0.5 rounded-full">
                          Super Admin
                        </span>
                      ) : (
                        <span className="text-xs font-bold bg-warning-soft text-warning px-2 py-0.5 rounded-full">
                          Admin + Dono
                        </span>
                      )}
                      <button
                        onClick={() => removeAdmin(admin.id, admin.name || admin.email)}
                        disabled={actionLoading === `team-${admin.id}`}
                        title="Remover acesso"
                        className="p-1.5 rounded-lg text-ink-4 hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
              <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Pagamentos das barbearias</h1>
              <p className="text-sm text-ink-3">Todos os pagamentos de mensalidade recebidos</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-3">Receita total acumulada</p>
              <p className="text-2xl font-bold text-positive">{formatCurrency(stats.saasRevenueTotal)}</p>
            </div>
          </div>

          <div className="bg-surface border border-line rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-sm font-semibold text-ink-3 bg-ground">
                  <th className="p-4">Data</th>
                  <th className="p-4">Barbearia</th>
                  <th className="p-4">Valor</th>
                  <th className="p-4">Método</th>
                  <th className="p-4">Origem</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2 text-sm">
                {(stats.saasPayments || []).map((p: any) => (
                  <tr key={p.id} className="hover:bg-ground">
                    <td className="p-4 text-ink-2">
                      {new Date(p.createdAt).toLocaleDateString('pt-BR')} {new Date(p.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4 text-ink font-medium">{p.barbershop?.name || "—"}</td>
                    <td className="p-4 font-bold text-ink">{formatCurrency(p.amount)}</td>
                    <td className="p-4 text-ink-3">{({ PIX: "Pix", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito", BOLETO: "Boleto", CASH: "Dinheiro", ACCOUNT_MONEY: "Saldo Mercado Pago" } as Record<string, string>)[p.method] ?? p.method}</td>
                    <td className="p-4">
                      {p.externalId
                        ? <span className="text-ink text-xs font-bold bg-surface-2 px-2 py-0.5 rounded-full">Mercado Pago</span>
                        : <span className="text-ink-3 text-xs font-bold bg-surface-2 px-2 py-0.5 rounded-full">Manual</span>
                      }
                    </td>
                    <td className="p-4">
                      {p.status === "PAID" ?
                        <span className="text-positive bg-positive-soft px-2 py-1 rounded-full text-xs font-bold">PAGO</span> :
                        p.status === "PENDING" ?
                        <span className="text-warning bg-warning-soft px-2 py-1 rounded-full text-xs font-bold">PENDENTE</span> :
                        <span className="text-danger bg-danger-soft px-2 py-1 rounded-full text-xs font-bold">{p.status}</span>
                      }
                    </td>
                  </tr>
                ))}
                {(!stats.saasPayments || stats.saasPayments.length === 0) && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-ink-3">Nenhum pagamento registrado ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ===== PLANOS TAB ===== */}
      {activeTab === "planos" && (
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Planos e preços</h1>
              <p className="text-sm text-ink-3">Edite preços, nomes e descrições dos planos. As mudanças valem para novos checkouts, cobrança recorrente e cálculo de MRR.</p>
            </div>
          </div>

          {planMsg && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
              planMsg.type === "success"
                ? "bg-positive-soft border border-positive/20 text-positive"
                : "bg-danger-soft border border-danger/20 text-danger"
            }`}>
              {planMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {planMsg.text}
            </div>
          )}

          <div className="flex items-start gap-3 bg-warning-soft border border-warning/20 rounded-2xl p-4">
            <AlertCircle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
            <p className="text-sm text-ink-3">
              Mudanças de preço afetam <strong className="text-ink-2">novos pagamentos e novas assinaturas</strong>. Assinantes recorrentes já criados no Mercado Pago mantêm o valor original até refazerem a assinatura. Toda alteração aqui é registrada na trilha de auditoria.
            </p>
          </div>

          {plansLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-ink border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {plans.map((p) => {
                const d = planDrafts[p.key] || p;
                const annualTotal = d.annualPriceMonthly != null && d.annualPriceMonthly !== ("" as any)
                  ? Number(d.annualPriceMonthly) * 12 : null;
                const dirty = JSON.stringify(d) !== JSON.stringify(p);
                return (
                  <div key={p.key} className="bg-surface border border-line rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold tracking-widest text-ink bg-surface-2 px-2 py-1 rounded-lg">{p.key}</span>
                      <div className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1.5 text-ink-3 cursor-pointer">
                          <input type="checkbox" checked={d.isPaid} onChange={(e) => setDraft(p.key, "isPaid", e.target.checked)} className="accent-[#1B1916]" />
                          Pago (MRR)
                        </label>
                        <label className="flex items-center gap-1.5 text-ink-3 cursor-pointer">
                          <input type="checkbox" checked={d.active} onChange={(e) => setDraft(p.key, "active", e.target.checked)} className="accent-[#1B1916]" />
                          Ativo
                        </label>
                        <label className="flex items-center gap-1.5 text-ink-3 cursor-pointer">
                          <input type="checkbox" checked={d.legacy} onChange={(e) => setDraft(p.key, "legacy", e.target.checked)} className="accent-[#1B1916]" />
                          Legado
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs text-ink-3 mb-1">Nome comercial</label>
                        <input value={d.label} onChange={(e) => setDraft(p.key, "label", e.target.value)}
                          className="w-full bg-surface-2 border border-control rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-ink-3 mb-1">Descrição curta</label>
                        <input value={d.tagline} onChange={(e) => setDraft(p.key, "tagline", e.target.value)}
                          className="w-full bg-surface-2 border border-control rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="block text-xs text-ink-3 mb-1">Preço mensal (R$)</label>
                        <input type="number" step="0.01" min="0" value={d.monthlyPrice}
                          onChange={(e) => setDraft(p.key, "monthlyPrice", e.target.value)}
                          className="w-full bg-surface-2 border border-control rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="block text-xs text-ink-3 mb-1">Mensal no plano anual (R$)</label>
                        <input type="number" step="0.01" min="0" placeholder="sem anual"
                          value={d.annualPriceMonthly ?? ""}
                          onChange={(e) => setDraft(p.key, "annualPriceMonthly", e.target.value === "" ? null : e.target.value)}
                          className="w-full bg-surface-2 border border-control rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
                      </div>
                      <div className="col-span-2 grid grid-cols-3 gap-3 pt-3 border-t border-line-2">
                        <div className="col-span-3 text-xs font-semibold text-ink-2">Barbeiro extra</div>
                        <div>
                          <label className="block text-xs text-ink-3 mb-1">Barbeiros inclusos</label>
                          <input type="number" step="1" min="0" value={d.includedBarbers ?? 0}
                            onChange={(e) => setDraft(p.key, "includedBarbers", e.target.value)}
                            className="w-full bg-surface-2 border border-control rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
                        </div>
                        <div>
                          <label className="block text-xs text-ink-3 mb-1">Cada extra / mês (R$)</label>
                          <input type="number" step="0.01" min="0" value={d.extraBarberMonthly ?? 0}
                            onChange={(e) => setDraft(p.key, "extraBarberMonthly", e.target.value)}
                            className="w-full bg-surface-2 border border-control rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
                        </div>
                        <div>
                          <label className="block text-xs text-ink-3 mb-1">No anual / mês (R$)</label>
                          <input type="number" step="0.01" min="0" placeholder="igual ao mensal" value={d.extraBarberAnnualMonthly ?? ""}
                            onChange={(e) => setDraft(p.key, "extraBarberAnnualMonthly", e.target.value === "" ? null : e.target.value)}
                            className="w-full bg-surface-2 border border-control rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
                        </div>
                        <p className="col-span-3 text-xs text-ink-3">
                          {Number(d.extraBarberMonthly) > 0
                            ? `Do ${Number(d.includedBarbers) + 1}º barbeiro em diante, + ${formatCurrency(Number(d.extraBarberMonthly))} por mês cada. Vale no próximo pagamento de cada barbearia; quem tem cobrança automática tem o valor atualizado quando a equipe muda.`
                            : "Sem cobrança por barbeiro: o preço cobre a equipe toda."}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-ink-3">
                        {annualTotal != null
                          ? `Cobrança anual: ${formatCurrency(annualTotal)}`
                          : "Sem cobrança anual"}
                      </p>
                      <button
                        onClick={() => savePlan(p.key)}
                        disabled={!dirty || savingPlan === p.key}
                        className="flex items-center gap-2 px-4 py-2 bg-ink hover:bg-ink/90 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {savingPlan === p.key
                          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : null}
                        Salvar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== INFRAESTRUTURA TAB ===== */}
      {activeTab === "infraestrutura" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Automações</h1>
              <p className="text-sm text-ink-3">Monitore o último run de cada cron job</p>
            </div>
            <button
              onClick={loadCronHealth}
              disabled={cronLoading}
              className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-control text-ink-2 text-sm rounded-xl hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${cronLoading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>

          {cronLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-ink border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-surface border border-line rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-sm font-semibold text-ink-3 bg-ground">
                    <th className="p-4">Job</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Último Run</th>
                    <th className="p-4">Duração</th>
                    <th className="p-4">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-2 text-sm">
                  {cronJobs.map((job) => (
                    <tr key={job.name} className="hover:bg-ground transition-colors">
                      <td className="p-4">
                        <p className="font-semibold text-ink">{job.label}</p>
                        <p className="text-xs text-ink-4 font-mono">{job.name}</p>
                      </td>
                      <td className="p-4">
                        {job.status === "ok" && (
                          <span className="flex items-center gap-1.5 text-positive text-xs font-bold">
                            <CheckCircle2 className="w-4 h-4" /> OK
                          </span>
                        )}
                        {job.status === "error" && (
                          <span className="flex items-center gap-1.5 text-danger text-xs font-bold">
                            <XCircle className="w-4 h-4" /> ERRO
                          </span>
                        )}
                        {job.status === "stale" && (
                          <span className="flex items-center gap-1.5 text-warning text-xs font-bold">
                            <AlertCircle className="w-4 h-4" /> ATRASADO
                          </span>
                        )}
                        {job.status === "never" && (
                          <span className="flex items-center gap-1.5 text-ink-3 text-xs font-bold">
                            <Clock className="w-4 h-4" /> NUNCA RODOU
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-ink-3">
                        {job.lastRun
                          ? new Date(job.lastRun).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
                          : <span className="text-ink-4">—</span>}
                      </td>
                      <td className="p-4 text-ink-3">
                        {job.durationMs != null
                          ? `${(job.durationMs / 1000).toFixed(1)}s`
                          : <span className="text-ink-4">—</span>}
                      </td>
                      <td className="p-4 text-ink-3 text-xs font-mono max-w-xs truncate">
                        {job.result
                          ? Object.entries(job.result)
                              .filter(([k]) => k !== "error" || job.status === "error")
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")
                          : <span className="text-ink-4">—</span>}
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
