"use client";
import { useEffect, useState, useRef } from "react";
import { CreditCard, Plus, Search, X, AlertTriangle, Check, Users, Banknote, Smartphone, CheckCircle, LayoutGrid, List, ChevronLeft, ChevronRight, Edit2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";

interface Subscription {
  id: string; status: string; startDate: string; nextBillingDate: string; billingDay: number | null; usesThisCycle: number;
  client: { id: string; name: string; email: string; phone: string | null };
  plan: { id: string; name: string; price: number; maxUses: number | null };
  payments: { status: string; amount: number; method: string; paidAt: string | null }[];
  beneficiaries?: any;
}
interface Plan { id: string; name: string; price: number }
interface Client { id: string; name: string; phone: string | null }

const PAYMENT_OPTIONS = [
  { value: "PIX", label: "PIX", icon: Smartphone, color: "text-green-600 bg-green-50 border-green-200" },
  { value: "DEBIT", label: "Débito", icon: CreditCard, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "CREDIT", label: "Crédito", icon: CreditCard, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { value: "CASH", label: "Dinheiro", icon: Banknote, color: "text-primary/90 bg-primary/10 border-amber-200" },
];

const METHOD_BADGE: Record<string, { label: string; cls: string }> = {
  PIX:    { label: "PIX",      cls: "bg-green-100 text-green-700" },
  DEBIT:  { label: "Débito",   cls: "bg-blue-100 text-blue-700" },
  CREDIT: { label: "Crédito",  cls: "bg-purple-100 text-purple-700" },
  CASH:   { label: "Dinheiro", cls: "bg-amber-100 text-amber-700" },
};

function isOverdue(nextBillingDate: string) {
  return new Date(nextBillingDate) <= new Date();
}

function PaymentModal({ sub, onConfirm, onClose }: {
  sub: Subscription;
  onConfirm: (subscriptionId: string, method: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function confirm() {
    if (!selected) return;
    setSaving(true);
    await onConfirm(sub.id, selected);
    setSaving(false);
    setDone(true);
    setTimeout(onClose, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Dar baixa — Pagamento</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
        <div className="px-5 py-4">
          {done ? (
            <div className="flex flex-col items-center py-4 gap-3">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="font-bold text-zinc-900">Pagamento registrado!</p>
            </div>
          ) : (
            <>
              <div className="bg-zinc-50 rounded-xl p-3 mb-4 text-sm space-y-1">
                <p className="font-semibold text-zinc-900">{sub.client.name}</p>
                <p className="text-zinc-500">{sub.plan.name}</p>
                <p className="text-primary/90 font-bold text-lg">{formatCurrency(sub.plan.price)}</p>
              </div>
              <p className="text-sm text-zinc-500 mb-3">Forma de pagamento recebida:</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_OPTIONS.map(({ value, label, icon: Icon, color }) => (
                  <button
                    key={value}
                    onClick={() => setSelected(value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      selected === value ? color + " ring-2 ring-offset-1 ring-current" : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-semibold">{label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={confirm}
                disabled={!selected || saving}
                className="w-full mt-4 py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check className="w-4 h-4" /> Confirmar Pagamento</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EditSubModal({ sub, plans, token, onSave, onClose }: {
  sub: Subscription; plans: Plan[]; token: string | null;
  onSave: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    planId: sub.plan.id,
    billingDay: String(sub.billingDay || ""),
    nextBillingDate: sub.nextBillingDate.split("T")[0],
    status: sub.status,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/barbershop/subscriptions/${sub.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        planId: form.planId,
        billingDay: form.billingDay ? Number(form.billingDay) : null,
        nextBillingDate: form.nextBillingDate,
        status: form.status,
      }),
    });
    setSaving(false);
    if (!res.ok) { alert("Erro ao editar assinante"); return; }
    onSave(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <h2 className="font-semibold text-zinc-900">Editar Assinante</h2>
            <p className="text-xs text-zinc-400">{sub.client.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100"><X className="w-4 h-4 text-zinc-500" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Plano</label>
            <select value={form.planId} onChange={(e) => setForm(f => ({ ...f, planId: e.target.value }))}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}/mês</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Dia de cobrança</label>
              <input type="number" min="1" max="31" value={form.billingDay}
                onChange={(e) => setForm(f => ({ ...f, billingDay: e.target.value }))}
                placeholder="Ex: 23"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Próx. vencimento</label>
              <input type="date" value={form.nextBillingDate}
                onChange={(e) => setForm(f => ({ ...f, nextBillingDate: e.target.value }))}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1.5">Status</label>
            <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="ACTIVE">Ativo</option>
              <option value="PAUSED">Pausado</option>
              <option value="OVERDUE">Vencido</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-40">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

type ViewMode = "table" | "cards";

export default function BarberAssinaturasPage() {
  const { token } = useAuthStore();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [activeFilter, setActiveFilter] = useState<"todos" | "vencidos">("todos");
  const [form, setForm] = useState({ clientName: "", clientPhone: "", planId: "", billingDay: "" });

  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [payingSub, setPayingSub] = useState<Subscription | null>(null);
  const [editSub, setEditSub] = useState<Subscription | null>(null);
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function handleClientNameChange(v: string) {
    setField("clientName", v);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.length < 2) { setClientSuggestions([]); return; }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/barbershop/clients?q=${encodeURIComponent(v)}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setClientSuggestions(d.clients || []));
    }, 200);
  }

  function selectClient(c: Client) {
    setField("clientName", c.name);
    setField("clientPhone", c.phone ?? "");
    setClientSuggestions([]);
    setShowSuggestions(false);
  }

  async function load() {
    const [sr, pr] = await Promise.all([
      fetch("/api/barbershop/subscriptions", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/barbershop/plans", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [sd, pd] = await Promise.all([sr.json(), pr.json()]);
    setSubs(sd.subscriptions || []);
    setPlans(pd.plans || []);
    setPageLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.planId) { alert("Selecione um plano"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/barbershop/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Erro ao criar assinatura"); return; }
      setOpen(false);
      setForm({ clientName: "", clientPhone: "", planId: "", billingDay: "" });
      load();
    } finally {
      setLoading(false);
    }
  }

  async function handlePayment(subscriptionId: string, method: string) {
    await fetch("/api/barbershop/subscriptions/pagamento", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscriptionId, method }),
    });
    load();
  }

  const overdueSubs = subs.filter((s) => s.status === "ACTIVE" && isOverdue(s.nextBillingDate));

  const filtered = subs.filter((s) =>
    s.client.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.client.phone ?? "").includes(search)
  );

  const filteredByTab = activeFilter === "vencidos"
    ? filtered.filter((s) => s.status === "ACTIVE" && isOverdue(s.nextBillingDate))
    : filtered;

  useEffect(() => { setPage(1); }, [search, activeFilter]);

  // Sort: vencidos primeiro, depois por nome
  const sorted = [...filteredByTab].sort((a, b) => {
    const aOverdue = isOverdue(a.nextBillingDate) ? 0 : 1;
    const bOverdue = isOverdue(b.nextBillingDate) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return a.client.name.localeCompare(b.client.name);
  });

  const totalPages = Math.ceil(sorted.length / perPage);
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="space-y-5">
      {payingSub && (
        <PaymentModal
          sub={payingSub}
          onConfirm={handlePayment}
          onClose={() => setPayingSub(null)}
        />
      )}
      {editSub && (
        <EditSubModal sub={editSub} plans={plans} token={token} onSave={load} onClose={() => setEditSub(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Assinantes</h1>
          {overdueSubs.length > 0 && (
            <p className="text-sm text-red-600 font-medium mt-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {overdueSubs.length} pagamento{overdueSubs.length > 1 ? "s" : ""} vencido{overdueSubs.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Assinante
        </Button>
      </div>

      {/* Barra de busca + filtros + toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white text-zinc-800"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg p-1">
          <button
            onClick={() => setActiveFilter("todos")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${activeFilter === "todos" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"}`}
          >
            Todos
          </button>
          <button
            onClick={() => setActiveFilter("vencidos")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${activeFilter === "vencidos" ? "bg-red-500 text-white" : "text-zinc-500 hover:text-zinc-900"}`}
          >
            {overdueSubs.length > 0 && <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${activeFilter === "vencidos" ? "bg-white text-red-500" : "bg-red-100 text-red-600"}`}>{overdueSubs.length}</span>}
            Vencidos
          </button>
        </div>
        <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden bg-white">
          <button
            onClick={() => setViewMode("table")}
            title="Visualização em tabela"
            className={`p-2 transition-colors ${viewMode === "table" ? "bg-zinc-900 text-white" : "text-zinc-400 hover:bg-zinc-50"}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("cards")}
            title="Visualização em cards"
            className={`p-2 transition-colors ${viewMode === "cards" ? "bg-zinc-900 text-white" : "text-zinc-400 hover:bg-zinc-50"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      {pageLoading ? (
        <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-zinc-50 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-zinc-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-zinc-100 rounded w-1/3" />
                <div className="h-3 bg-zinc-100 rounded w-1/4" />
              </div>
              <div className="h-3 bg-zinc-100 rounded w-20" />
              <div className="h-3 bg-zinc-100 rounded w-16" />
              <div className="h-8 bg-zinc-100 rounded-lg w-28" />
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-zinc-400 bg-white rounded-xl border border-zinc-100">
          <Users className="w-12 h-12 mb-3" />
          <p className="font-medium">Nenhum assinante encontrado</p>
        </div>
      ) : viewMode === "table" ? (
        /* ── TABELA ── */
        <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Plano</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Valor</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Vencimento</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Forma</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((s, idx) => {
                  const overdue = s.status === "ACTIVE" && isOverdue(s.nextBillingDate);
                  const lastPaid = s.payments.find((p) => p.status === "PAID");
                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-zinc-50 last:border-0 transition-colors ${
                        overdue ? "bg-red-50/40 hover:bg-red-50/70" : idx % 2 === 0 ? "bg-white hover:bg-zinc-50/60" : "bg-zinc-50/20 hover:bg-zinc-50/60"
                      }`}
                    >
                      {/* Cliente */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                            overdue ? "bg-red-100 text-red-700" : "bg-primary/15 text-amber-700"
                          }`}>
                            {getInitials(s.client.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-900 truncate leading-tight">{s.client.name}</p>
                            {s.client.phone && (
                              <p className="text-xs text-zinc-400 leading-tight mt-0.5">{s.client.phone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Plano */}
                      <td className="px-4 py-3.5">
                        <span className="text-zinc-700 font-medium whitespace-nowrap">{s.plan.name}</span>
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-bold text-primary whitespace-nowrap">{formatCurrency(s.plan.price)}</span>
                        <span className="text-zinc-400 text-xs">/mês</span>
                      </td>

                      {/* Vencimento */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          {overdue ? (
                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                              <AlertTriangle className="w-3 h-3" />
                              {formatDate(s.nextBillingDate)}
                            </span>
                          ) : (
                            <span className="text-zinc-700 text-xs font-medium whitespace-nowrap">{formatDate(s.nextBillingDate)}</span>
                          )}
                          {s.billingDay && (
                            <span className="text-[10px] text-primary/70 font-medium">dia {s.billingDay}</span>
                          )}
                          {lastPaid?.paidAt && (
                            <span className="text-[10px] text-green-600 flex items-center gap-0.5 mt-0.5">
                              <Check className="w-2.5 h-2.5" />
                              pago {new Date(lastPaid.paidAt).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Forma de pagamento */}
                      <td className="px-4 py-3.5 text-center">
                        {lastPaid?.method && METHOD_BADGE[lastPaid.method] ? (
                          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${METHOD_BADGE[lastPaid.method].cls}`}>
                            {METHOD_BADGE[lastPaid.method].label}
                          </span>
                        ) : (
                          <span className="text-zinc-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Ação */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditSub(s)}
                            className="px-2 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" /> Editar
                          </button>
                          {s.status === "ACTIVE" && (
                            <button
                              onClick={() => setPayingSub(s)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1 ${
                                overdue
                                  ? "bg-red-500 hover:bg-red-600 text-white"
                                  : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              {overdue ? "Cobrar e dar baixa" : "Dar baixa"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rodapé com paginação */}
          <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/50 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span className="uppercase tracking-wide font-medium">
              {sorted.length === 0
                ? "Nenhum assinante"
                : `Mostrando ${(page - 1) * perPage + 1}–${Math.min(page * perPage, sorted.length)} de ${sorted.length} assinante${sorted.length !== 1 ? "s" : ""}`}
            </span>
            <div className="flex items-center gap-2">
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pg = i + 1;
                    if (totalPages > 5) {
                      if (page <= 3) pg = i + 1;
                      else if (page >= totalPages - 2) pg = totalPages - 4 + i;
                      else pg = page - 2 + i;
                    }
                    return (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        className={`w-7 h-7 rounded-lg font-semibold transition-colors ${page === pg ? "bg-zinc-900 text-white" : "hover:bg-zinc-200 text-zinc-600"}`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1 rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[10, 25, 50].map((n) => <option key={n} value={n}>Mostrar: {n}</option>)}
              </select>
            </div>
          </div>
        </div>
      ) : (
        /* ── CARDS ── */
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((s) => {
            const overdue = s.status === "ACTIVE" && isOverdue(s.nextBillingDate);
            const lastPaid = s.payments.find((p) => p.status === "PAID");
            return (
              <div key={s.id} className={`bg-white rounded-xl border shadow-sm p-5 transition-all ${overdue ? "border-red-200 bg-red-50/30" : "border-zinc-100"}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${overdue ? "bg-red-100 text-red-700" : "bg-primary/20 text-amber-700"}`}>
                    <span className="font-bold text-xs">{getInitials(s.client.name)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-zinc-900 truncate">{s.client.name}</p>
                      <Badge status={s.status} />
                      {overdue && (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-2.5 h-2.5" /> Vencido
                        </span>
                      )}
                    </div>
                    {s.client.phone && <p className="text-xs text-zinc-400 mt-0.5">{s.client.phone}</p>}
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Plano</span>
                    <span className="font-semibold text-zinc-800">{s.plan.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Mensalidade</span>
                    <span className="font-bold text-primary">{formatCurrency(s.plan.price)}/mês</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Próx. vencimento</span>
                    <div className="text-right">
                      <span className={`text-xs font-semibold ${overdue ? "text-red-600" : "text-zinc-700"}`}>
                        {formatDate(s.nextBillingDate)}
                      </span>
                      {s.billingDay && (
                        <p className="text-[10px] text-primary/80 font-semibold">todo dia {s.billingDay}</p>
                      )}
                    </div>
                  </div>
                  {lastPaid && (
                    <div className="flex items-center gap-1 text-[11px] text-green-600 mt-1">
                      <Check className="w-3 h-3" />
                      Último pagamento: {lastPaid.paidAt ? new Date(lastPaid.paidAt).toLocaleDateString("pt-BR") : "—"}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setEditSub(s)}
                    className="flex-none px-3 py-2 rounded-xl text-xs font-semibold border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                  {s.status === "ACTIVE" && (
                    <button
                      onClick={() => setPayingSub(s)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
                        overdue
                          ? "bg-red-500 hover:bg-red-600 text-white"
                          : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {overdue ? "Cobrar e dar baixa" : "Dar baixa no pagamento"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => { setOpen(false); setClientSuggestions([]); }} title="Novo Assinante">
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">Nome do cliente</label>
            <div className="relative">
              <input
                value={form.clientName}
                onChange={(e) => handleClientNameChange(e.target.value)}
                onFocus={() => form.clientName.length >= 2 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Buscar ou digitar nome..."
                required
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {showSuggestions && clientSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  {clientSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => selectClient(c)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-50 flex items-center justify-between gap-2 border-b border-zinc-100 last:border-0"
                    >
                      <span className="font-medium text-zinc-900">{c.name}</span>
                      {c.phone && <span className="text-xs text-zinc-400 shrink-0">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Input label="WhatsApp" type="tel" value={form.clientPhone} onChange={(e) => setField("clientPhone", e.target.value)} required />
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">Plano</label>
            <select value={form.planId} onChange={(e) => setField("planId", e.target.value)} required className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Selecione um plano...</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}/mês</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">Dia de vencimento <span className="text-zinc-400 font-normal">(opcional)</span></label>
            <select value={form.billingDay} onChange={(e) => setField("billingDay", e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Sem dia fixo</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>Dia {d}</option>
              ))}
            </select>
          </div>
          <Button type="submit" loading={loading} className="w-full mt-2">Registrar Assinante</Button>
        </form>
      </Modal>
    </div>
  );
}
