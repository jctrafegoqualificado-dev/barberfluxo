"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/store/auth";
import {
  DollarSign, TrendingDown, Clock, CheckCircle2, Plus, Trash2,
  ChevronDown, ChevronUp, Building2, Zap, Users, ShoppingBag,
  Megaphone, Wrench, Receipt, HelpCircle, X, AlertCircle,
  ArrowLeft, ArrowRight, Loader2, Check, Download, Printer
} from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  name: string;
  description?: string;
  amount: number;
  category: string;
  type: string;
  isRecurring: boolean;
  dueDay?: number;
  paymentMethod?: string;
  status: string;
  month: string;
  dueDate?: string;
  paidAt?: string;
  notes?: string;
}

interface Summary {
  totalDespesas: number;
  totalPagas: number;
  totalPendentes: number;
  totalVencidas: number;
  byCategory: Record<string, number>;
}

interface PrevSummary {
  totalDespesas: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: "ESTRUTURA",   label: "Estrutura",          icon: Building2,  color: "text-slate-600   bg-slate-50   border-slate-200" },
  { key: "UTILIDADES",  label: "Utilidades",          icon: Zap,        color: "text-yellow-600  bg-yellow-50  border-yellow-200" },
  { key: "PESSOAS",     label: "Pessoas",             icon: Users,      color: "text-blue-600    bg-blue-50    border-blue-200" },
  { key: "PRODUTOS",    label: "Produtos/Fornecedores", icon: ShoppingBag, color: "text-green-600  bg-green-50   border-green-200" },
  { key: "MARKETING",   label: "Marketing",           icon: Megaphone,  color: "text-pink-600    bg-pink-50    border-pink-200" },
  { key: "EQUIPAMENTOS",label: "Equipamentos",        icon: Wrench,     color: "text-orange-600  bg-orange-50  border-orange-200" },
  { key: "TAXAS",       label: "Taxas & Impostos",    icon: Receipt,    color: "text-red-600     bg-red-50     border-red-200" },
  { key: "OUTROS",      label: "Outros",              icon: HelpCircle, color: "text-zinc-500    bg-zinc-50    border-zinc-200" },
];

const PAYMENT_METHODS = ["PIX", "CASH", "CREDIT", "DEBIT", "BOLETO"];
const PAYMENT_LABELS: Record<string, string> = {
  PIX: "PIX", CASH: "Dinheiro", CREDIT: "Cartão Crédito",
  DEBIT: "Cartão Débito", BOLETO: "Boleto",
};

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getCategoryMeta(key: string) {
  return CATEGORIES.find(c => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string;
  color: string; icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-black text-zinc-900 tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID:    "bg-green-50 text-green-600 border-green-100",
    PENDING: "bg-amber-50 text-amber-600 border-amber-100",
    OVERDUE: "bg-red-50   text-red-500   border-red-100",
  };
  const labels: Record<string, string> = { PAID: "Paga", PENDING: "Pendente", OVERDUE: "Vencida" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[status] ?? map.PENDING}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ─── Add Expense Modal ────────────────────────────────────────────────────────

function AddExpenseModal({ month, onClose, onSaved }: {
  month: string; onClose: () => void; onSaved: () => void;
}) {
  const token = useAuthStore(s => s.token);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", amount: "", category: "ESTRUTURA", type: "FIXED",
    isRecurring: false, dueDay: "", paymentMethod: "PIX",
    description: "", notes: "", replicateMonths: "3",
  });

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/barbershop/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount.replace(",", ".")),
          dueDay: form.dueDay ? parseInt(form.dueDay) : undefined,
          replicateMonths: form.isRecurring ? parseInt(form.replicateMonths) : 1,
          month,
        }),
      });
      onSaved();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h3 className="font-black text-zinc-900">Nova Despesa</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Nome */}
          <div>
            <label className="text-xs font-bold text-zinc-600 mb-1 block">Nome da despesa *</label>
            <input
              required value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="Ex: Aluguel, Conta de luz..."
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Valor + Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-600 mb-1 block">Valor (R$) *</label>
              <input
                required value={form.amount} onChange={e => set("amount", e.target.value)}
                placeholder="0,00" type="text" inputMode="decimal"
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-600 mb-1 block">Categoria</label>
              <select value={form.category} onChange={e => set("category", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Tipo + Pagamento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-600 mb-1 block">Tipo</label>
              <select value={form.type} onChange={e => set("type", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                <option value="FIXED">Fixa (recorrente)</option>
                <option value="VARIABLE">Variável (avulsa)</option>
                <option value="EXTRAORDINARY">Extraordinária</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-600 mb-1 block">Forma de pag.</label>
              <select value={form.paymentMethod} onChange={e => set("paymentMethod", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}
              </select>
            </div>
          </div>

          {/* Recorrente */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <input type="checkbox" id="recorrente" checked={form.isRecurring}
              onChange={e => set("isRecurring", e.target.checked)}
              className="w-4 h-4 accent-primary rounded" />
            <label htmlFor="recorrente" className="text-sm font-medium text-zinc-700 flex-1">
              Repetir automaticamente nos próximos meses
            </label>
          </div>

          {form.isRecurring && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-zinc-600 mb-1 block">Dia do vencimento</label>
                <input value={form.dueDay} onChange={e => set("dueDay", e.target.value)}
                  type="number" min="1" max="31" placeholder="Ex: 5"
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-600 mb-1 block">Repetir por (meses)</label>
                <input value={form.replicateMonths} onChange={e => set("replicateMonths", e.target.value)}
                  type="number" min="1" max="24" placeholder="3"
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="text-xs font-bold text-zinc-600 mb-1 block">Observações</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              rows={2} placeholder="Notas adicionais..."
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {loading ? "Salvando..." : "Adicionar Despesa"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const token = useAuthStore(s => s.token);
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), "yyyy-MM"));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [prevSummary, setPrevSummary] = useState<PrevSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ── Receitas do mês (via dashboard API)
  const [monthRevenue, setMonthRevenue] = useState(0);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/barbershop/expenses?month=${currentMonth}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setExpenses(data.expenses ?? []);
      setSummary(data.summary ?? null);
      setPrevSummary(data.prevSummary ?? null);
    } finally {
      setLoading(false);
    }
  }, [token, currentMonth]);

  const fetchRevenue = useCallback(async () => {
    try {
      const res = await fetch(`/api/barbershop/dashboard?period=month`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMonthRevenue(data?.kpis?.revenue?.value ?? 0);
    } catch { /* silencioso */ }
  }, [token]);

  useEffect(() => { fetchExpenses(); fetchRevenue(); }, [fetchExpenses, fetchRevenue]);

  async function markPaid(id: string, currentStatus: string) {
    setUpdatingId(id);
    const newStatus = currentStatus === "PAID" ? "PENDING" : "PAID";
    await fetch("/api/barbershop/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status: newStatus }),
    });
    await fetchExpenses();
    setUpdatingId(null);
  }

  async function deleteExpense(id: string) {
    if (!confirm("Remover esta despesa?")) return;
    await fetch(`/api/barbershop/expenses?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchExpenses();
  }

  // ── Navegação de mês
  const monthLabel = format(new Date(currentMonth + "-15"), "MMMM 'de' yyyy", { locale: ptBR });
  const lucroLiquido = monthRevenue - (summary?.totalDespesas ?? 0);
  const margemLiquida = monthRevenue > 0 ? Math.round((lucroLiquido / monthRevenue) * 100) : 0;

  // ── Agrupar por categoria
  const byCategory = CATEGORIES.map(cat => ({
    ...cat,
    expenses: expenses.filter(e => e.category === cat.key),
    total: expenses.filter(e => e.category === cat.key).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.expenses.length > 0);

  // ── Projeção de Saldo
  const diasNoMes = new Date(new Date(currentMonth + "-01").getFullYear(), new Date(currentMonth + "-01").getMonth() + 1, 0).getDate();
  const hoje = new Date().getDate();
  const projecaoReceita = hoje > 0 ? (monthRevenue / hoje) * diasNoMes : 0;
  const projecaoSaldo = projecaoReceita - (summary?.totalDespesas ?? 0);

  // ── Comparativo
  const despesaVsMesPassado = prevSummary?.totalDespesas 
    ? ((summary?.totalDespesas ?? 0) - prevSummary.totalDespesas) / prevSummary.totalDespesas * 100 
    : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 pb-24">

      {/* Header + navegação de mês */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-zinc-900">Gestão Financeira</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Controle de despesas e fluxo de caixa</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(format(subMonths(new Date(currentMonth + "-15"), 1), "yyyy-MM"))}
            className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-zinc-800 capitalize min-w-[150px] text-center">{monthLabel}</span>
          <button onClick={() => setCurrentMonth(format(addMonths(new Date(currentMonth + "-15"), 1), "yyyy-MM"))}
            className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 transition-colors">
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <div className="h-6 w-px bg-zinc-200 mx-2 hidden sm:block"></div>
          
          <button onClick={() => window.open(`/api/barbershop/financeiro/export?month=${currentMonth}&token=${token}`)}
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold text-sm transition-colors"
            title="Exportar CSV para Contador">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={() => window.print()}
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold text-sm transition-colors">
            <Printer className="w-4 h-4" />
          </button>

          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
            Nova
          </button>
        </div>
      </div>

      {/* DRE Simplificada */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 text-white">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">
          Demonstrativo — {monthLabel}
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">(+) Receita Total</span>
            <span className="font-bold text-green-400">{formatCurrency(monthRevenue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">(−) Despesas Totais</span>
            <div className="flex items-center gap-3">
              {despesaVsMesPassado !== 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${despesaVsMesPassado > 0 ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                  {despesaVsMesPassado > 0 ? "↑" : "↓"} {Math.abs(despesaVsMesPassado).toFixed(1)}% vs anterior
                </span>
              )}
              <span className="font-bold text-red-400">{formatCurrency(summary?.totalDespesas ?? 0)}</span>
            </div>
          </div>
          <div className="border-t border-zinc-700 pt-3 flex items-center justify-between">
            <span className="font-bold text-white">Lucro Líquido</span>
            <div className="text-right">
              <span className={`text-xl font-black ${lucroLiquido >= 0 ? "text-green-400" : "text-red-400"}`}>
                {formatCurrency(lucroLiquido)}
              </span>
              <p className="text-xs text-zinc-400 mt-1">
                Margem: {margemLiquida}% • <span className="text-zinc-300">Projeção fim do mês: {formatCurrency(projecaoSaldo)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Despesas"  value={formatCurrency(summary?.totalDespesas ?? 0)}
          color="bg-red-50 text-red-500" icon={TrendingDown} />
        <KpiCard label="Pagas"           value={formatCurrency(summary?.totalPagas ?? 0)}
          sub={`${expenses.filter(e => e.status === "PAID").length} item(s)`}
          color="bg-green-50 text-green-600" icon={CheckCircle2} />
        <KpiCard label="Pendentes"       value={formatCurrency(summary?.totalPendentes ?? 0)}
          sub={`${expenses.filter(e => e.status === "PENDING").length} item(s)`}
          color="bg-amber-50 text-amber-600" icon={Clock} />
        <KpiCard label="Vencidas"        value={formatCurrency(summary?.totalVencidas ?? 0)}
          sub={expenses.filter(e => e.status === "OVERDUE").length > 0 ? "⚠️ Atenção!" : "Tudo em dia"}
          color="bg-zinc-50 text-zinc-500" icon={AlertCircle} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Lista por categoria */}
      {!loading && byCategory.length === 0 && (
        <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-zinc-400">
          <DollarSign className="w-10 h-10 text-zinc-200" />
          <p className="font-bold text-sm">Nenhuma despesa cadastrada</p>
          <p className="text-xs text-zinc-300">Clique em "Nova Despesa" para começar</p>
          <button onClick={() => setShowModal(true)}
            className="mt-2 px-4 py-2 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90">
            Adicionar primeira despesa
          </button>
        </div>
      )}

      {!loading && byCategory.map(cat => {
        const isOpen = expandedCat === cat.key;
        const Icon = cat.icon;
        return (
          <div key={cat.key} className="bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden">
            {/* Cabeçalho da categoria */}
            <button
              onClick={() => setExpandedCat(isOpen ? null : cat.key)}
              className="w-full px-5 py-4 flex items-center gap-3 hover:bg-zinc-50/50 transition-colors"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${cat.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-zinc-900">{cat.label}</p>
                <p className="text-[10px] text-zinc-400">{cat.expenses.length} item(s)</p>
              </div>
              <span className="font-black text-zinc-800 text-sm">{formatCurrency(cat.total)}</span>
              {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>

            {/* Despesas da categoria */}
            {isOpen && (
              <div className="border-t border-zinc-100 divide-y divide-zinc-50">
                {cat.expenses.map(exp => (
                  <div key={exp.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-zinc-50/30 transition-colors">
                    {/* Check de pago */}
                    <button
                      onClick={() => markPaid(exp.id, exp.status)}
                      disabled={updatingId === exp.id}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        exp.status === "PAID"
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-zinc-300 hover:border-green-400"
                      }`}
                    >
                      {updatingId === exp.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : exp.status === "PAID" && <Check className="w-3 h-3" />
                      }
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${exp.status === "PAID" ? "line-through text-zinc-400" : "text-zinc-900"}`}>
                        {exp.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge status={exp.status} />
                        {exp.isRecurring && (
                          <span className="text-[10px] bg-blue-50 text-blue-500 border border-blue-100 px-1.5 py-0.5 rounded-full font-bold">
                            Recorrente
                          </span>
                        )}
                        {exp.dueDay && (
                          <span className="text-[10px] text-zinc-400">Vence dia {exp.dueDay}</span>
                        )}
                        {exp.paymentMethod && (
                          <span className="text-[10px] text-zinc-400">{PAYMENT_LABELS[exp.paymentMethod] ?? exp.paymentMethod}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-zinc-800">{formatCurrency(exp.amount)}</p>
                      {exp.paidAt && (
                        <p className="text-[10px] text-zinc-400">
                          Pago {format(new Date(exp.paidAt), "dd/MM")}
                        </p>
                      )}
                    </div>

                    <button onClick={() => deleteExpense(exp.id)}
                      className="p-1.5 rounded-lg text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {showModal && (
        <AddExpenseModal
          month={currentMonth}
          onClose={() => setShowModal(false)}
          onSaved={fetchExpenses}
        />
      )}
    </div>
  );
}
