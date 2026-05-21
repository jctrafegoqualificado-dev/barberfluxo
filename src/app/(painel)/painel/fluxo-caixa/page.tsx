"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/store/auth";
import {
  Loader2, DollarSign, ArrowUpRight, ArrowDownRight,
  Lock, Unlock, Plus, X, Clock, Banknote, CreditCard, Wallet,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CashEntry {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  createdAt: string;
}

interface CashSession {
  id: string;
  status: "OPEN" | "CLOSED";
  openingBalance: number;
  closingBalance?: number;
  createdAt: string;
  closedAt?: string;
  notes?: string;
  entries: CashEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Dinheiro", PIX: "PIX", CREDIT: "Crédito", DEBIT: "Débito",
  CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito", BOLETO: "Boleto",
};

const CATEGORY_LABELS: Record<string, string> = {
  SUPRIMENTO: "Suprimento", SANGRIA: "Sangria", VENDA: "Venda",
  SERVICO: "Serviço", OUTROS: "Outros",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FluxoCaixaPage() {
  const token = useAuthStore(s => s.token);
  const [session, setSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/barbershop/cashflow", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSession(data.session ?? null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // ── Computed values
  const entries = session?.entries ?? [];
  const totalIncome = entries.filter(e => e.type === "INCOME").reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter(e => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0);
  const currentBalance = (session?.openingBalance ?? 0) + totalIncome - totalExpense;
  const isOpen = session?.status === "OPEN";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900">Fluxo de Caixa</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Abertura, movimentações e fechamento do caixa diário
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isOpen ? (
            <button
              onClick={() => setShowOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-sm"
            >
              <Unlock className="w-4 h-4" /> Abrir Caixa
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-sm"
              >
                <Plus className="w-4 h-4" /> Lançamento
              </button>
              <button
                onClick={() => setShowClose(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-sm"
              >
                <Lock className="w-4 h-4" /> Fechar Caixa
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── No session ── */}
      {!session && (
        <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-16 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center">
            <Banknote className="w-8 h-8 text-zinc-300" />
          </div>
          <h2 className="font-bold text-zinc-900 text-lg">Nenhum caixa aberto</h2>
          <p className="text-sm text-zinc-400 max-w-sm">
            Abra o caixa para começar a registrar entradas e saídas do dia. 
            Informe o valor inicial em dinheiro (troco).
          </p>
          <button
            onClick={() => setShowOpen(true)}
            className="mt-2 flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:opacity-90 transition-opacity"
          >
            <Unlock className="w-4 h-4" /> Abrir Caixa Agora
          </button>
        </div>
      )}

      {/* ── Active session ── */}
      {session && (
        <>
          {/* Status bar */}
          <div className={`rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
            isOpen
              ? "bg-gradient-to-r from-green-600 to-green-500 text-white"
              : "bg-zinc-100 text-zinc-700"
          }`}>
            <div className="flex items-center gap-3 flex-1">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isOpen ? "bg-white/20" : "bg-zinc-200"
              }`}>
                {isOpen ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-black text-sm">
                  Caixa {isOpen ? "Aberto" : "Fechado"}
                </p>
                <p className={`text-xs ${isOpen ? "text-green-100" : "text-zinc-400"}`}>
                  Aberto em {format(new Date(session.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {session.closedAt && (
                    <> · Fechado em {format(new Date(session.closedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>
                  )}
                </p>
              </div>
            </div>
            {session.notes && (
              <p className={`text-xs italic ${isOpen ? "text-green-100" : "text-zinc-400"}`}>
                {session.notes}
              </p>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Saldo Inicial</span>
              </div>
              <p className="text-xl font-black text-zinc-900">{fmt(session.openingBalance)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Entradas</span>
              </div>
              <p className="text-xl font-black text-green-600">{fmt(totalIncome)}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{entries.filter(e => e.type === "INCOME").length} lançamento(s)</p>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Saídas</span>
              </div>
              <p className="text-xl font-black text-red-500">{fmt(totalExpense)}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{entries.filter(e => e.type === "EXPENSE").length} lançamento(s)</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Saldo Atual</span>
              </div>
              <p className={`text-2xl font-black ${currentBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
                {fmt(currentBalance)}
              </p>
              {session.closingBalance !== undefined && session.closingBalance !== null && !isOpen && (
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Fechamento informado: {fmt(session.closingBalance)}
                  {Math.abs(currentBalance - session.closingBalance) > 0.01 && (
                    <span className="text-amber-400 ml-1">
                      (diferença: {fmt(Math.abs(currentBalance - session.closingBalance))})
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Entries list */}
          <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h2 className="font-bold text-zinc-900 text-sm">Movimentações</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Todos os lançamentos desta sessão</p>
            </div>
            {entries.length === 0 ? (
              <div className="py-16 text-center text-zinc-400">
                <Clock className="w-8 h-8 mx-auto mb-3 text-zinc-200" />
                <p className="font-bold text-sm">Nenhuma movimentação ainda</p>
                <p className="text-xs text-zinc-300 mt-1">Clique em &quot;Lançamento&quot; para registrar</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-50">
                {entries.map(entry => (
                  <div key={entry.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-zinc-50/50 transition-colors">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      entry.type === "INCOME"
                        ? "bg-green-50 text-green-600 border-green-200"
                        : "bg-red-50 text-red-500 border-red-200"
                    }`}>
                      {entry.type === "INCOME"
                        ? <ArrowUpRight className="w-4 h-4" />
                        : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{entry.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full font-medium">
                          {CATEGORY_LABELS[entry.category] ?? entry.category}
                        </span>
                        <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full font-medium">
                          {METHOD_LABELS[entry.paymentMethod] ?? entry.paymentMethod}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-zinc-400 shrink-0 hidden sm:block">
                      {format(new Date(entry.createdAt), "HH:mm")}
                    </span>
                    <p className={`text-sm font-black shrink-0 ${
                      entry.type === "INCOME" ? "text-green-600" : "text-red-500"
                    }`}>
                      {entry.type === "INCOME" ? "+" : "−"}{fmt(entry.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {showOpen && <OpenCashModal onClose={() => setShowOpen(false)} onSaved={load} />}
      {showClose && session && <CloseCashModal sessionId={session.id} currentBalance={currentBalance} onClose={() => setShowClose(false)} onSaved={load} />}
      {showAdd && session && <AddEntryModal sessionId={session.id} onClose={() => setShowAdd(false)} onSaved={load} />}
    </div>
  );
}

// ─── Open Cash Modal ──────────────────────────────────────────────────────────
function OpenCashModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const token = useAuthStore(s => s.token);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/barbershop/cashflow", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ openingBalance: parseFloat(amount.replace(",", ".")) || 0 }),
      });
      onSaved();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h3 className="font-black text-zinc-900">Abrir Caixa</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Informe o valor inicial (troco)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-600 mb-1 block">Valor inicial (R$)</label>
            <input
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0,00" type="text" inputMode="decimal" autoFocus
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
            />
            <p className="text-[11px] text-zinc-400 mt-1.5 text-center">Deixe 0 se não houver troco</p>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
            {loading ? "Abrindo..." : "Abrir Caixa"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Close Cash Modal ─────────────────────────────────────────────────────────
function CloseCashModal({ sessionId, currentBalance, onClose, onSaved }: {
  sessionId: string; currentBalance: number; onClose: () => void; onSaved: () => void;
}) {
  const token = useAuthStore(s => s.token);
  const [amount, setAmount] = useState(currentBalance.toFixed(2).replace(".", ","));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/barbershop/cashflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sessionId,
          closingBalance: parseFloat(amount.replace(",", ".")) || 0,
          notes: notes || undefined,
        }),
      });
      onSaved();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const closingVal = parseFloat(amount.replace(",", ".")) || 0;
  const diff = closingVal - currentBalance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h3 className="font-black text-zinc-900">Fechar Caixa</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Confira o valor e finalize</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="bg-zinc-50 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Saldo esperado</p>
            <p className="text-2xl font-black text-zinc-900">{fmt(currentBalance)}</p>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-600 mb-1 block">Valor real no caixa (R$)</label>
            <input
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0,00" type="text" inputMode="decimal" autoFocus
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
            />
          </div>
          {Math.abs(diff) > 0.01 && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
              diff > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {diff > 0 ? `Sobra de ${fmt(diff)}` : `Falta de ${fmt(Math.abs(diff))}`}
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-zinc-600 mb-1 block">Observações (opcional)</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Notas sobre o fechamento..."
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {loading ? "Fechando..." : "Fechar Caixa"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Add Entry Modal ──────────────────────────────────────────────────────────
function AddEntryModal({ sessionId, onClose, onSaved }: {
  sessionId: string; onClose: () => void; onSaved: () => void;
}) {
  const token = useAuthStore(s => s.token);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: "INCOME" as "INCOME" | "EXPENSE",
    category: "VENDA",
    description: "",
    amount: "",
    paymentMethod: "CASH",
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/barbershop/cashflow/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sessionId,
          ...form,
          amount: parseFloat(form.amount.replace(",", ".")) || 0,
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h3 className="font-black text-zinc-900">Novo Lançamento</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Adicionar movimento ao caixa</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            {(["INCOME", "EXPENSE"] as const).map(t => (
              <button key={t} type="button" onClick={() => set("type", t)}
                className={`py-3 rounded-xl font-bold text-sm transition-all ${
                  form.type === t
                    ? t === "INCOME" ? "bg-green-600 text-white" : "bg-red-500 text-white"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}>
                {t === "INCOME" ? "↑ Entrada" : "↓ Saída"}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-600 mb-1 block">Descrição *</label>
            <input required value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Ex: Sangria, Suprimento, Venda avulsa..."
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-600 mb-1 block">Valor (R$) *</label>
              <input required value={form.amount} onChange={e => set("amount", e.target.value)}
                placeholder="0,00" type="text" inputMode="decimal"
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-600 mb-1 block">Forma de pag.</label>
              <select value={form.paymentMethod} onChange={e => set("paymentMethod", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-600 mb-1 block">Categoria</label>
            <select value={form.category} onChange={e => set("category", e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading}
            className={`w-full py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 ${
              form.type === "INCOME" ? "bg-green-600" : "bg-red-500"
            }`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {loading ? "Salvando..." : form.type === "INCOME" ? "Registrar Entrada" : "Registrar Saída"}
          </button>
        </form>
      </div>
    </div>
  );
}
