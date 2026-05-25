"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/store/auth";
import {
  TrendingUp, TrendingDown, Zap, Wallet, Plus, X, Loader2,
  ArrowLeft, ArrowRight, Check, Trash2, ChevronDown, ChevronUp,
  Download, Printer, Building2, Users, ShoppingBag, Megaphone,
  Wrench, Receipt, HelpCircle, AlertCircle, Clock, CheckCircle2,
  DollarSign, CreditCard, Banknote, ArrowUpRight, ArrowDownRight, Smartphone,
} from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  amount: number;
  fee: number;
  net: number;
  paymentMethod: string;
  paymentMethodLabel: string;
  status: string;
  date: string;
  category: string;
  clientOrBarber?: string;
}

interface Kpis {
  receitas: number;
  despesas: number;
  despesasFixas: number;
  despesasVariaveis: number;
  taxas: number;
  taxasDebito: number;
  taxasCredito: number;
  saldo: number;
  pendentes: number;
  prevReceitas: number;
  prevDespesas: number;
}

interface AvulsoData {
  bruto: number;
  liquido: number;
  taxaTotal: number;
}

interface Counts {
  all: number;
  income: number;
  expense: number;
  pending: number;
}

interface ApiResponse {
  month: string;
  transactions: Transaction[];
  kpis: Kpis;
  counts: Counts;
  avulso: AvulsoData;
  mensalidades: number;
}

// ─── Expense modal types ──────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "ESTRUTURA",    label: "Estrutura",           icon: Building2 },
  { key: "UTILIDADES",   label: "Utilidades",           icon: Zap },
  { key: "PESSOAS",      label: "Pessoas",              icon: Users },
  { key: "PRODUTOS",     label: "Produtos/Fornecedores", icon: ShoppingBag },
  { key: "MARKETING",    label: "Marketing",            icon: Megaphone },
  { key: "EQUIPAMENTOS", label: "Equipamentos",         icon: Wrench },
  { key: "TAXAS",        label: "Taxas & Impostos",     icon: Receipt },
  { key: "OUTROS",       label: "Outros",               icon: HelpCircle },
];

const CATEGORY_COLORS: Record<string, string> = {
  ESTRUTURA: "bg-slate-50 text-slate-600 border-slate-200",
  UTILIDADES: "bg-yellow-50 text-yellow-600 border-yellow-200",
  PESSOAS: "bg-blue-50 text-blue-600 border-blue-200",
  PRODUTOS: "bg-green-50 text-green-600 border-green-200",
  MARKETING: "bg-pink-50 text-pink-600 border-pink-200",
  EQUIPAMENTOS: "bg-orange-50 text-orange-600 border-orange-200",
  TAXAS: "bg-red-50 text-red-600 border-red-200",
  ATENDIMENTO: "bg-primary/5 text-primary border-primary/20",
  ASSINATURA: "bg-emerald-50 text-emerald-600 border-emerald-200",
  OUTROS: "bg-zinc-50 text-zinc-500 border-zinc-200",
};

const PAYMENT_METHODS = ["PIX", "CASH", "CREDIT", "DEBIT", "BOLETO"];
const PAYMENT_LABELS: Record<string, string> = {
  PIX: "PIX", CASH: "Dinheiro", CREDIT: "Cartão Crédito",
  DEBIT: "Cartão Débito", BOLETO: "Boleto",
  SUBSCRIPTION: "Assinatura", CREDIT_CARD: "Cartão Crédito", DEBIT_CARD: "Cartão Débito",
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(current: number, prev: number) {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, change, color, icon: Icon, highlight, extra,
}: {
  label: string; value: string; sub?: string;
  change?: number | null; color: string; icon: React.ElementType; highlight?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border shadow-sm p-5 ${highlight ? "bg-zinc-900 border-zinc-700" : "bg-white border-zinc-150"}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className={`text-xs font-bold uppercase tracking-wider ${highlight ? "text-zinc-400" : "text-zinc-500"}`}>{label}</span>
      </div>
      <p className={`text-2xl font-black tracking-tight ${highlight ? "text-white" : "text-zinc-900"}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {change !== null && change !== undefined && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
            change > 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
          }`}>
            {change > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
            {Math.abs(change)}%
          </span>
        )}
        {sub && <p className={`text-[11px] ${highlight ? "text-zinc-400" : "text-zinc-400"}`}>{sub}</p>}
      </div>
      {extra && (
        <div className={`mt-3 pt-3 space-y-1.5 ${highlight ? "border-t border-zinc-700/50" : "border-t border-dashed border-zinc-200"}`}>
          {extra}
        </div>
      )}
    </div>
  );
}

function KpiSub({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-zinc-400 font-medium">{label}</span>
      <span className={`text-[11px] font-bold ${color ?? "text-zinc-600"}`}>{value}</span>
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────
function Tab({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
        active
          ? "bg-primary text-white shadow-sm"
          : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
      }`}
    >
      {label}
      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
        active ? "bg-white/20 text-white" : "bg-zinc-200 text-zinc-600"
      }`}>
        {count}
      </span>
    </button>
  );
}

// ─── Transaction Row ──────────────────────────────────────────────────────────
function TransactionRow({ t, onDelete }: { t: Transaction; onDelete?: (id: string) => void }) {
  const isIncome = t.type === "INCOME";
  const catColor = CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.OUTROS;

  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-zinc-50/60 transition-colors group">
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${catColor}`}>
        {isIncome
          ? <ArrowUpRight className="w-4 h-4" />
          : <ArrowDownRight className="w-4 h-4" />
        }
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 truncate">{t.description}</p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {t.clientOrBarber && (
            <span className="text-[10px] text-zinc-400">{t.clientOrBarber}</span>
          )}
          <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full font-medium">
            {t.paymentMethodLabel}
          </span>
          {t.status === "PENDING" && (
            <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded-full font-bold">
              Pendente
            </span>
          )}
          {t.status === "OVERDUE" && (
            <span className="text-[10px] bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded-full font-bold">
              Vencida
            </span>
          )}
        </div>
      </div>

      {/* Date */}
      <span className="text-[11px] text-zinc-400 shrink-0 hidden sm:block">
        {format(new Date(t.date), "dd/MM")}
      </span>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className={`text-sm font-black ${isIncome ? "text-green-600" : "text-red-500"}`}>
          {isIncome ? "+" : "−"}{fmt(t.amount)}
        </p>
        {t.fee > 0 && (
          <p className="text-[10px] text-zinc-400">Taxa: {fmt(t.fee)}</p>
        )}
      </div>

      {/* Delete (expenses only) */}
      {!isIncome && onDelete && (
        <button
          onClick={() => onDelete(t.id)}
          className="p-1.5 rounded-lg text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
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
    notes: "", replicateMonths: "3",
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
          <div>
            <h3 className="font-black text-zinc-900">Nova Despesa</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Adicionar saída ao financeiro</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-600 mb-1 block">Nome da despesa *</label>
            <input
              required value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="Ex: Aluguel, Conta de luz..."
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
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
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-600 mb-1 block">Repetir por (meses)</label>
                <input value={form.replicateMonths} onChange={e => set("replicateMonths", e.target.value)}
                  type="number" min="1" max="24" placeholder="3"
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-zinc-600 mb-1 block">Observações</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              rows={2} placeholder="Notas adicionais..."
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
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
type TabKey = "all" | "income" | "expense" | "pending";

export default function FinanceiroPage() {
  const token = useAuthStore(s => s.token);
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), "yyyy-MM"));
  const [data, setData] = useState<ApiResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const load = useCallback(async (month: string, tab: TabKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/barbershop/transactions?month=${month}&tab=${tab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { 
    setCurrentPage(1);
    load(currentMonth, activeTab); 
  }, [currentMonth, activeTab, load]);

  async function deleteExpense(id: string) {
    if (!confirm("Remover esta despesa?")) return;
    await fetch(`/api/barbershop/expenses?id=${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    load(currentMonth, activeTab);
  }

  const monthLabel = format(new Date(currentMonth + "-15"), "MMMM 'de' yyyy", { locale: ptBR });
  const kpis = data?.kpis;
  const counts = data?.counts ?? { all: 0, income: 0, expense: 0, pending: 0 };

  const changePct = (curr: number, prev: number) => {
    if (!prev) return null;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const totalRows = data?.transactions?.length ?? 0;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginatedTransactions = data?.transactions?.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage) ?? [];

  return (
    <div className="space-y-6 pb-24">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900">Financeiro</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Receitas, despesas e fluxo de caixa da barbearia</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Navegação de mês */}
          <button
            onClick={() => setCurrentMonth(format(subMonths(new Date(currentMonth + "-15"), 1), "yyyy-MM"))}
            className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-zinc-800 capitalize min-w-[160px] text-center">{monthLabel}</span>
          <button
            onClick={() => setCurrentMonth(format(addMonths(new Date(currentMonth + "-15"), 1), "yyyy-MM"))}
            className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="h-6 w-px bg-zinc-200 mx-1 hidden sm:block" />

          <button
            onClick={async () => {
              const res = await fetch(`/api/barbershop/financeiro/export?month=${currentMonth}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) return;
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `fechamento_${currentMonth}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold text-sm transition-colors"
          >
            <Download className="w-4 h-4" /> CSV
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova Despesa
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Receitas"
          value={fmt(kpis?.receitas ?? 0)}
          change={changePct(kpis?.receitas ?? 0, kpis?.prevReceitas ?? 0)}
          sub="vs. mês anterior"
          color="bg-green-50 text-green-600"
          icon={TrendingUp}
          extra={
            <>
              <KpiSub label="Avulso" value={fmt(data?.avulso?.bruto ?? 0)} color="text-green-600" />
              <KpiSub label="Mensalidades" value={fmt(data?.mensalidades ?? 0)} color="text-amber-600" />
            </>
          }
        />
        <KpiCard
          label="Despesas"
          value={fmt(kpis?.despesas ?? 0)}
          change={changePct(kpis?.despesas ?? 0, kpis?.prevDespesas ?? 0)}
          sub="vs. mês anterior"
          color="bg-red-50 text-red-500"
          icon={TrendingDown}
          extra={
            <>
              <KpiSub label="Fixas" value={fmt(kpis?.despesasFixas ?? 0)} color="text-red-500" />
              <KpiSub label="Variáveis" value={fmt(kpis?.despesasVariaveis ?? 0)} color="text-orange-500" />
            </>
          }
        />
        <KpiCard
          label="Taxas"
          value={fmt(kpis?.taxas ?? 0)}
          sub="Taxas de máquina"
          color="bg-amber-50 text-amber-600"
          icon={Zap}
          extra={
            <>
              <KpiSub label="Débito" value={fmt(kpis?.taxasDebito ?? 0)} color="text-blue-600" />
              <KpiSub label="Crédito" value={fmt(kpis?.taxasCredito ?? 0)} color="text-purple-600" />
            </>
          }
        />
        <KpiCard
          label="Saldo"
          value={fmt(kpis?.saldo ?? 0)}
          sub="Receitas − despesas − taxas"
          color={`${(kpis?.saldo ?? 0) >= 0 ? "bg-primary/10 text-primary" : "bg-red-100 text-red-600"}`}
          icon={Wallet}
          highlight
          extra={
            <>
              <KpiSub
                label="Margem"
                value={`${(kpis?.receitas ?? 0) > 0 ? Math.round(((kpis?.saldo ?? 0) / (kpis?.receitas ?? 1)) * 100) : 0}%`}
                color={(kpis?.saldo ?? 0) >= 0 ? "text-green-400" : "text-red-400"}
              />
              <KpiSub label="Contas a Pagar" value={fmt(kpis?.pendentes ?? 0)} color="text-amber-400" />
            </>
          }
        />
      </div>


      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="px-4 pt-4 pb-0 border-b border-zinc-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-3 scrollbar-none flex-1">
            {([
              { key: "all", label: "Todas" },
              { key: "income", label: "Entradas" },
              { key: "expense", label: "Saídas" },
              { key: "pending", label: "Pendentes" },
            ] as { key: TabKey; label: string }[]).map(tab => (
              <Tab
                key={tab.key}
                label={tab.label}
                count={counts[tab.key]}
                active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              />
            ))}
          </div>
          
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-zinc-500 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200 mb-3 shrink-0">
            <span>Mostrar:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-transparent border-none font-bold focus:outline-none text-zinc-700 cursor-pointer"
            >
              {[10, 20, 50, 100].map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Transaction list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : totalRows === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-400">
            <DollarSign className="w-10 h-10 text-zinc-200" />
            <p className="font-bold text-sm">Nenhum lançamento neste período</p>
            <p className="text-xs text-zinc-300">
              {activeTab === "income" ? "Finalize atendimentos para gerar entradas" :
               activeTab === "expense" ? "Clique em \"Nova Despesa\" para registrar saídas" :
               activeTab === "pending" ? "Nenhuma conta pendente — tudo em dia! 🎉" :
               "Nenhum movimento financeiro neste mês"}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-zinc-50">
              {paginatedTransactions.map(t => (
                <TransactionRow
                  key={t.id}
                  t={t}
                  onDelete={t.type === "EXPENSE" ? deleteExpense : undefined}
                />
              ))}
            </div>
            
            {/* Pagination Footer */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-zinc-500 font-medium">
                  Mostrando <span className="font-bold text-zinc-900">{(currentPage - 1) * rowsPerPage + 1}</span> a{" "}
                  <span className="font-bold text-zinc-900">{Math.min(currentPage * rowsPerPage, totalRows)}</span> de{" "}
                  <span className="font-bold text-zinc-900">{totalRows}</span>
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="px-3 text-xs font-bold text-zinc-400">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <AddExpenseModal
          month={currentMonth}
          onClose={() => setShowModal(false)}
          onSaved={() => load(currentMonth, activeTab)}
        />
      )}
    </div>
  );
}
