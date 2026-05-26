"use client";
import { useEffect, useState, useRef } from "react";
import { CreditCard, Plus, Search, Banknote, Smartphone, AlertTriangle, Check, X, Trash2, Users, TrendingUp, DollarSign, MessageSquare, Calendar, Edit2, Clock, FileText, RotateCcw, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Filter } from "lucide-react";
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

const PAYMENT_OPTIONS = [
  { value: "PIX", label: "PIX", icon: Smartphone, color: "text-green-600 bg-green-50 border-green-200" },
  { value: "DEBIT", label: "Débito", icon: CreditCard, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "CREDIT", label: "Crédito", icon: CreditCard, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { value: "CASH", label: "Dinheiro", icon: Banknote, color: "text-primary/90 bg-primary/10 border-amber-200" },
];

const METHOD_LABELS: Record<string, string> = { PIX: "PIX", DEBIT: "Débito", CREDIT: "Crédito", CASH: "Dinheiro" };

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

  async function confirm() {
    if (!selected) return;
    setSaving(true);
    await onConfirm(sub.id, selected);
    setSaving(false);
    onClose();
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
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50">
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={!selected || saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Confirmar"}
          </button>
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

export default function AssinaturasPage() {
  const { token } = useAuthStore();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [paymentSub, setPaymentSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "overdue" | "paused" | "cancelled">("all");
  const [form, setForm] = useState({ clientName: "", clientPhone: "", clientEmail: "", planId: "", billingDay: "" });
  const [usageModal, setUsageModal] = useState<Subscription | null>(null);
  const [editSub, setEditSub] = useState<Subscription | null>(null);

  // Autocomplete no modal de novo assinante
  const [clientSuggestions, setClientSuggestions] = useState<{ id: string; name: string; phone: string | null; email: string | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const clientDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extrato do Assinante (Sprint 2)
  const [extratoSub, setExtratoSub] = useState<any | null>(null);
  const [extratoTab, setExtratoTab] = useState<"info" | "consumo" | "pagamentos">("info");
  const [extratoHistory, setExtratoHistory] = useState<any[]>([]);
  const [extratoLoading, setExtratoLoading] = useState(false);

  // States para o inline edit e cobrança WhatsApp
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");

  // Sorting & Pagination states
  const [sortField, setSortField] = useState<"name" | "price" | "nextBillingDate">("nextBillingDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function handleClientNameChange(v: string) {
    setField("clientName", v);
    setShowSuggestions(true);
    if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current);
    if (v.length < 2) { setClientSuggestions([]); return; }
    clientDebounceRef.current = setTimeout(() => {
      fetch(`/api/barbershop/clients?q=${encodeURIComponent(v)}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setClientSuggestions(d.clients || []));
    }, 200);
  }

  function selectClientSuggestion(c: { id: string; name: string; phone: string | null; email: string | null }) {
    setField("clientName", c.name);
    setField("clientPhone", c.phone ?? "");
    // Preenche e-mail real se o cliente tiver (ignora e-mails sintéticos gerados pelo sistema)
    const isReal = c.email && !/@cliente\./i.test(c.email);
    setField("clientEmail", isReal ? c.email! : "");
    setClientSuggestions([]);
    setShowSuggestions(false);
  }

  function handleWhatsAppCobrança(s: Subscription) {
    const phone = s.client.phone?.replace(/\D/g, "");
    if (!phone) {
      alert("Este cliente não possui telefone cadastrado!");
      return;
    }
    const message = `Olá, ${s.client.name}! Tudo bem? Passando para lembrar que a mensalidade do seu plano *${s.plan.name}* venceu em ${new Date(s.nextBillingDate).toLocaleDateString("pt-BR")}. Se preferir realizar o pagamento via PIX, a nossa chave é a cadastrada na barbearia. Assim que realizar o pagamento, me avise para darmos baixa aqui! Obrigado! 💈`;
    const encodedText = encodeURIComponent(message);
    window.open(`https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${encodedText}`, "_blank");
  }

  async function handleUpdateBillingDate(id: string) {
    if (!editDate) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/barbershop/subscriptions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nextBillingDate: editDate }),
      });
      if (!res.ok) {
        alert("Erro ao atualizar data de cobrança");
      } else {
        setEditingId(null);
        load();
      }
    } finally {
      setLoading(false);
    }
  }

  async function load() {
    const [sr, pr] = await Promise.all([
      fetch("/api/barbershop/subscriptions", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/barbershop/plans", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [sd, pd] = await Promise.all([sr.json(), pr.json()]);
    setSubs(sd.subscriptions || []);
    setPlans(pd.plans || []);
  }

  useEffect(() => { load(); }, []);

  // Reset pagination when searching or filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter]);

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
      setForm({ clientName: "", clientPhone: "", clientEmail: "", planId: "", billingDay: "" });
      load();
    } finally {
      setLoading(false);
    }
  }

  async function handleUsage(subscriptionId: string, beneficiaryName: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/barbershop/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscriptionId, beneficiaryName }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Erro ao lançar uso"); return; }
      setUsageModal(null);
      load();
    } finally {
      setLoading(false);
    }
  }

  async function loadExtrato(s: Subscription) {
    setExtratoTab("info");
    setExtratoLoading(true);
    setExtratoSub(null);
    setExtratoHistory([]);
    try {
      const [detailRes, histRes] = await Promise.all([
        fetch(`/api/barbershop/subscriptions/${s.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/barbershop/subscriptions/${s.id}/history`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [detailData, histData] = await Promise.all([detailRes.json(), histRes.json()]);
      setExtratoSub(detailData.subscription || null);
      setExtratoHistory(histData.history || []);
    } finally {
      setExtratoLoading(false);
    }
  }

  async function handleExtratoPayment(subscriptionId: string, method: string) {
    setExtratoLoading(true);
    try {
      await fetch("/api/barbershop/subscriptions/pagamento", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscriptionId, method }),
      });
      const sub = subs.find(s => s.id === subscriptionId);
      if (sub) await loadExtrato(sub);
      load();
    } finally {
      setExtratoLoading(false);
    }
  }

  async function handleUndoPayment(subscriptionId: string) {
    if (!confirm("Deseja realmente desfazer o último pagamento confirmado?")) return;
    setExtratoLoading(true);
    try {
      const res = await fetch(`/api/barbershop/subscriptions/pagamento?subscriptionId=${subscriptionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao desfazer pagamento");
        return;
      }
      const sub = subs.find(s => s.id === subscriptionId);
      if (sub) await loadExtrato(sub);
      load();
    } finally {
      setExtratoLoading(false);
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

  async function handleDelete(id: string) {
    if (!confirm("Deseja realmente excluir esta assinatura?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/barbershop/subscriptions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert("Erro ao excluir"); return; }
      load();
    } finally {
      setLoading(false);
    }
  }

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: typeof sortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-zinc-400 group-hover:text-zinc-600 transition-colors shrink-0" />;
    return sortDirection === "asc" 
      ? <ChevronUp className="w-3.5 h-3.5 ml-1 text-primary font-bold shrink-0" />
      : <ChevronDown className="w-3.5 h-3.5 ml-1 text-primary font-bold shrink-0" />;
  };

  const overdueSubs = subs.filter((s) => s.status === "ACTIVE" && isOverdue(s.nextBillingDate));

  const totalActive = subs.filter((s) => s.status === "ACTIVE").length;
  const overdueCount = overdueSubs.length;
  const mrr = subs.filter((s) => s.status === "ACTIVE").reduce((sum, s) => sum + s.plan.price, 0);
  const overdueTotal = overdueSubs.reduce((sum, s) => sum + s.plan.price, 0);

  const filtered = subs
    .filter((s) => {
      if (filter === "all") return true;
      if (filter === "active") return s.status === "ACTIVE" && !isOverdue(s.nextBillingDate);
      if (filter === "overdue") return s.status === "OVERDUE" || (s.status === "ACTIVE" && isOverdue(s.nextBillingDate));
      if (filter === "paused") return s.status === "PAUSED";
      if (filter === "cancelled") return s.status === "CANCELLED";
      return true;
    })
    .filter((s) =>
      s.client.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.client.phone ?? "").includes(search)
    );

  const sorted = [...filtered].sort((a, b) => {
    let valA: any;
    let valB: any;

    if (sortField === "name") {
      valA = a.client.name;
      valB = b.client.name;
    } else if (sortField === "price") {
      valA = a.plan.price;
      valB = b.plan.price;
    } else if (sortField === "nextBillingDate") {
      valA = a.nextBillingDate;
      valB = b.nextBillingDate;
    }

    if (typeof valA === "string") {
      return sortDirection === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }

    return sortDirection === "asc" ? valA - valB : valB - valA;
  });

  const totalRows = sorted.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginated = sorted.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="space-y-6">
      {paymentSub && (
        <PaymentModal sub={paymentSub} onConfirm={handlePayment} onClose={() => setPaymentSub(null)} />
      )}
      {editSub && (
        <EditSubModal sub={editSub} plans={plans} token={token} onSave={load} onClose={() => setEditSub(null)} />
      )}

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

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Assinantes Ativos</p>
            <p className="text-2xl font-bold text-zinc-900 mt-0.5">{totalActive}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Faturamento (MRR)</p>
            <p className="text-2xl font-bold text-zinc-900 mt-0.5">{formatCurrency(mrr)}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Vencidos (Qtd)</p>
            <p className="text-2xl font-bold text-zinc-900 mt-0.5">{overdueCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Inadimplência Total</p>
            <p className="text-2xl font-bold text-zinc-900 mt-0.5">{formatCurrency(overdueTotal)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white text-zinc-800" />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex rounded-lg border border-zinc-200 overflow-x-auto hide-scrollbar text-sm font-medium">
            <button onClick={() => setFilter("all")} className={`px-3 py-2 shrink-0 transition-colors ${filter === "all" ? "bg-primary text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}>Todos</button>
            <button onClick={() => setFilter("active")} className={`px-3 py-2 shrink-0 transition-colors border-l border-zinc-200 ${filter === "active" ? "bg-emerald-500 text-white border-transparent" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}>Ativas</button>
            <button onClick={() => setFilter("overdue")} className={`px-3 py-2 shrink-0 flex items-center gap-1 transition-colors border-l border-zinc-200 ${filter === "overdue" ? "bg-red-500 text-white border-transparent" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}>
              <AlertTriangle className="w-3.5 h-3.5" /> Vencidas {overdueSubs.length > 0 && `(${overdueSubs.length})`}
            </button>
            <button onClick={() => setFilter("paused")} className={`px-3 py-2 shrink-0 transition-colors border-l border-zinc-200 ${filter === "paused" ? "bg-amber-500 text-white border-transparent" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}>Pausadas</button>
            <button onClick={() => setFilter("cancelled")} className={`px-3 py-2 shrink-0 transition-colors border-l border-zinc-200 ${filter === "cancelled" ? "bg-zinc-500 text-white border-transparent" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}>Canceladas</button>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 ml-auto md:ml-0 bg-white px-3 py-2 rounded-lg border border-zinc-200">
            <span>Mostrar:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-transparent border-none font-bold focus:outline-none text-zinc-700 cursor-pointer"
            >
              {[10, 25, 50].map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden flex flex-col justify-between">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-zinc-400">
            <CreditCard className="w-12 h-12 mb-3" />
            <p className="font-medium">Nenhum assinante encontrado</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50/80 text-zinc-500 text-xs font-bold uppercase tracking-wider border-b border-zinc-200">
                  <tr>
                    <th onClick={() => handleSort("name")} className="px-6 py-4 cursor-pointer hover:bg-zinc-100/50 transition-colors group select-none text-zinc-700">
                      <div className="flex items-center">
                        Cliente
                        {renderSortIcon("name")}
                      </div>
                    </th>
                    <th className="px-6 py-4 select-none text-zinc-700">Plano</th>
                    <th onClick={() => handleSort("price")} className="px-6 py-4 text-right cursor-pointer hover:bg-zinc-100/50 transition-colors group select-none text-zinc-700">
                      <div className="flex items-center justify-end">
                        Preço Mensal
                        {renderSortIcon("price")}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center select-none text-zinc-700">Usos no Mês/Ciclo</th>
                    <th onClick={() => handleSort("nextBillingDate")} className="px-6 py-4 text-center cursor-pointer hover:bg-zinc-100/50 transition-colors group select-none text-zinc-700">
                      <div className="flex items-center justify-center">
                        Vencimento / Próx. Fatura
                        {renderSortIcon("nextBillingDate")}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center select-none text-zinc-700">Status</th>
                    <th className="px-6 py-4 text-right select-none font-bold text-zinc-700">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {paginated.map((s) => {
                    const overdue = s.status === "ACTIVE" && isOverdue(s.nextBillingDate);
                    const lastPaid = s.payments.find((p) => p.status === "PAID");

                    return (
                      <tr key={s.id} className={`hover:bg-zinc-50/40 transition-colors ${overdue ? "bg-red-50/20" : ""}`}>
                        {/* Cliente Info */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${overdue ? "bg-red-100 text-red-700" : "bg-primary/20 text-amber-700"}`}>
                              <span className="font-bold text-xs">{getInitials(s.client.name)}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-semibold truncate ${overdue ? "text-red-800 font-bold" : "text-zinc-900"}`}>{s.client.name}</p>
                                {overdue && (
                                  <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                    <AlertTriangle className="w-2.5 h-2.5" /> Vencido
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-400">{s.client.email}</p>
                              {s.client.phone && <p className="text-[10px] text-zinc-400 mt-0.5">Whats: {s.client.phone}</p>}
                              {lastPaid && (
                                <p className="text-[10px] text-green-600 mt-0.5 flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" /> Último: {METHOD_LABELS[lastPaid.method] ?? lastPaid.method} em {lastPaid.paidAt ? new Date(lastPaid.paidAt).toLocaleDateString("pt-BR") : "—"}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Plano */}
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-zinc-700">{s.plan.name}</span>
                        </td>

                        {/* Preço Mensal */}
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-zinc-900">{formatCurrency(s.plan.price)}</span>
                          <span className="text-[10px] text-zinc-400 block mt-0.5">/mês</span>
                        </td>

                        {/* Usos no Mês/Ciclo */}
                        <td className="px-6 py-4 text-center">
                          {Array.isArray(s.beneficiaries) && s.beneficiaries.length > 0 ? (
                            <div className="flex flex-col gap-0.5 inline-block text-left">
                              {s.beneficiaries.map((b: any, idx: number) => (
                                <p key={idx} className="text-[11px] font-medium text-zinc-700 whitespace-nowrap">
                                  <span className="text-zinc-500">{b.name}:</span> {b.uses}/{b.maxUses}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-zinc-700">
                              {s.usesThisCycle}{s.plan.maxUses ? `/${s.plan.maxUses}` : ""}
                            </span>
                          )}
                        </td>

                        {/* Vencimento / Próx. Fatura */}
                        <td className="px-6 py-4 text-center">
                          {editingId === s.id ? (
                            <div className="flex items-center gap-1 justify-center">
                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="text-xs p-1.5 border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-primary w-28 bg-white text-zinc-800"
                              />
                              <button
                                onClick={() => handleUpdateBillingDate(s.id)}
                                className="p-1.5 rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
                                title="Salvar"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center justify-center gap-1.5 group">
                                <span className={`text-xs font-medium ${overdue ? "text-red-600 font-bold" : "text-zinc-600"}`}>
                                  {formatDate(s.nextBillingDate)}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingId(s.id);
                                    const d = new Date(s.nextBillingDate);
                                    const formatted = d.toISOString().split('T')[0];
                                    setEditDate(formatted);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-700 transition-all"
                                  title="Editar data de cobrança"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                              {s.billingDay && (
                                <span className="text-[10px] font-semibold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
                                  todo dia {s.billingDay}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center">
                            <Badge status={s.status} />
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap max-w-[280px] ml-auto">
                            {s.status === "ACTIVE" && (
                              <button
                                onClick={() => setUsageModal(s)}
                                className="text-[11px] px-2 py-1 rounded-md bg-primary text-white font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap shadow-sm"
                              >
                                Lançar uso
                              </button>
                            )}
                            {overdue && (
                              <>
                                <button
                                  onClick={() => setPaymentSub(s)}
                                  className="text-[11px] px-2 py-1 rounded-md bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors whitespace-nowrap shadow-sm"
                                >
                                  Dar baixa (Pagto)
                                </button>
                                <button
                                  onClick={() => handleWhatsAppCobrança(s)}
                                  className="text-[11px] px-2 py-1 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shadow-sm"
                                  title="Cobrar via WhatsApp"
                                >
                                  <MessageSquare className="w-3 h-3" /> PIX
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setEditSub(s)}
                              className="text-[11px] px-2 py-1 rounded-md border border-zinc-200 text-zinc-600 font-semibold hover:bg-zinc-50 transition-colors whitespace-nowrap flex items-center gap-0.5 shadow-sm"
                            >
                              <Edit2 className="w-3 h-3" /> Editar
                            </button>
                            <button
                              onClick={() => loadExtrato(s)}
                              className="text-[11px] px-2 py-1 rounded-md border border-zinc-200 text-zinc-600 font-semibold hover:bg-zinc-50 transition-colors whitespace-nowrap flex items-center gap-0.5 shadow-sm"
                            >
                              <FileText className="w-3 h-3" /> Extrato
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="p-1 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                              title="Excluir assinatura"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Pagination Widget */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                  Mostrando {(currentPage - 1) * rowsPerPage + 1} a{" "}
                  {Math.min(currentPage * rowsPerPage, totalRows)} de {totalRows} assinantes
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4 text-zinc-600" />
                  </button>
                  
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pNum = idx + 1;
                    if (
                      totalPages > 5 &&
                      pNum !== 1 &&
                      pNum !== totalPages &&
                      Math.abs(currentPage - pNum) > 1
                    ) {
                      if (pNum === 2 && currentPage > 3) {
                        return <span key="ell-1" className="px-1.5 text-zinc-400 text-xs self-center">...</span>;
                      }
                      if (pNum === totalPages - 1 && currentPage < totalPages - 2) {
                        return <span key="ell-2" className="px-1.5 text-zinc-400 text-xs self-center">...</span>;
                      }
                      return null;
                    }

                    return (
                      <button
                        key={pNum}
                        onClick={() => setCurrentPage(pNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all duration-150 ${
                          currentPage === pNum
                            ? "bg-primary border-primary text-white shadow-sm"
                            : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600"
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
                  >
                    <ChevronRight className="w-4 h-4 text-zinc-600" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Lançar Uso */}
      {usageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h2 className="font-semibold text-zinc-900">Lançar uso do plano</h2>
              <button onClick={() => setUsageModal(null)} className="p-1 rounded-lg hover:bg-zinc-100"><X className="w-4 h-4 text-zinc-500" /></button>
            </div>
            <div className="p-5">
              <p className="text-sm text-zinc-500 mb-4">Escolha quem está realizando o serviço agora:</p>
              <div className="space-y-2">
                {Array.isArray(usageModal.beneficiaries) && (usageModal.beneficiaries as any[]).map((b, i) => (
                  <button
                    key={i}
                    onClick={() => handleUsage(usageModal.id, b.name)}
                    disabled={loading || b.uses >= b.maxUses}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-zinc-200 hover:border-primary hover:bg-primary/10 transition-all text-left disabled:opacity-40"
                  >
                    <div>
                      <p className="font-bold text-zinc-900">{b.name}</p>
                      <p className="text-xs text-zinc-500">Cota: {b.uses}/{b.maxUses}</p>
                    </div>
                    {b.uses >= b.maxUses ? (
                      <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">Limite atingido</span>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary/90 flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-5 pt-0">
              <button onClick={() => setUsageModal(null)} className="w-full py-3 rounded-xl border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Extrato do Assinante — 3 Abas */}
      {extratoSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-zinc-900 text-lg">Extrato — {extratoSub.client.name}</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">{extratoSub.plan.name} • {formatCurrency(extratoSub.plan.price)}/mês</p>
                </div>
                <button onClick={() => setExtratoSub(null)} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 mt-4 bg-zinc-100 rounded-xl p-1">
                {(["info", "consumo", "pagamentos"] as const).map((tab) => {
                  const labels = { info: "Informações", consumo: "Consumo", pagamentos: "Pagamentos" };
                  const icons = { info: <FileText className="w-3.5 h-3.5" />, consumo: <Clock className="w-3.5 h-3.5" />, pagamentos: <DollarSign className="w-3.5 h-3.5" /> };
                  return (
                    <button
                      key={tab}
                      onClick={() => setExtratoTab(tab)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        extratoTab === tab
                          ? "bg-white text-zinc-900 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-700"
                      }`}
                    >
                      {icons[tab]} {labels[tab]}
                      {tab === "pagamentos" && extratoSub.payments && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          extratoSub.payments.filter((p: any) => p.status === "PENDING").length > 0
                            ? "bg-red-100 text-red-600"
                            : "bg-zinc-200 text-zinc-600"
                        }`}>
                          {extratoSub.payments.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {extratoLoading ? (
                <p className="text-center py-16 text-zinc-400 font-medium">Carregando extrato...</p>
              ) : extratoTab === "info" ? (
                /* === ABA INFORMAÇÕES === */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-50 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Cliente</p>
                      <p className="text-sm font-bold text-zinc-900 mt-1">{extratoSub.client.name}</p>
                      <p className="text-xs text-zinc-500">{extratoSub.client.phone || "Sem telefone"}</p>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Plano</p>
                      <p className="text-sm font-bold text-zinc-900 mt-1">{extratoSub.plan.name}</p>
                      <p className="text-xs text-primary font-bold">{formatCurrency(extratoSub.plan.price)}/mês</p>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Início</p>
                      <p className="text-sm font-bold text-zinc-900 mt-1">{formatDate(extratoSub.startDate)}</p>
                    </div>
                    <div className={`rounded-xl p-4 ${isOverdue(extratoSub.nextBillingDate) ? "bg-red-50" : "bg-zinc-50"}`}>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Próx. Cobrança</p>
                      <p className={`text-sm font-bold mt-1 ${isOverdue(extratoSub.nextBillingDate) ? "text-red-600" : "text-zinc-900"}`}>
                        {formatDate(extratoSub.nextBillingDate)}
                      </p>
                      {extratoSub.billingDay && (
                        <p className="text-[10px] text-primary font-semibold mt-0.5">vence todo dia {extratoSub.billingDay}</p>
                      )}
                      {isOverdue(extratoSub.nextBillingDate) && <p className="text-[10px] text-red-500 font-bold mt-0.5">VENCIDO</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-50 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Status</p>
                      <div className="mt-1.5"><Badge status={extratoSub.status} /></div>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Usos no Ciclo</p>
                      <p className="text-sm font-bold text-zinc-900 mt-1">
                        {extratoSub.usesThisCycle}{extratoSub.plan.maxUses ? ` / ${extratoSub.plan.maxUses}` : " (ilimitado)"}
                      </p>
                    </div>
                  </div>
                  {extratoSub.plan.planServices?.length > 0 && (
                    <div className="border border-zinc-100 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Serviços Inclusos</p>
                      <div className="space-y-1.5">
                        {extratoSub.plan.planServices.map((ps: any) => (
                          <div key={ps.service.id} className="flex items-center gap-2 text-sm">
                            <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            <span className="text-zinc-700">{ps.service.name}</span>
                            <span className="text-zinc-400 ml-auto text-xs">{formatCurrency(ps.service.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(extratoSub.beneficiaries) && extratoSub.beneficiaries.length > 0 && (
                    <div className="border border-zinc-100 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Beneficiários</p>
                      <div className="space-y-2">
                        {extratoSub.beneficiaries.map((b: any, i: number) => (
                          <div key={i} className="flex items-center justify-between bg-zinc-50 rounded-lg p-3">
                            <span className="text-sm font-semibold text-zinc-800">{b.name}</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${b.uses >= b.maxUses ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                              {b.uses}/{b.maxUses} usos
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : extratoTab === "consumo" ? (
                /* === ABA CONSUMO === */
                <div>
                  {/* Painel Saldo de Serviços */}
                  {extratoSub.plan.planServices?.length > 0 && (() => {
                    // Calcula usos por serviço a partir do histórico
                    const usageByService: Record<string, number> = {};
                    extratoHistory.forEach((item: any) => {
                      if (item.services?.length > 0) {
                        item.services.forEach((as: any) => {
                          usageByService[as.service.id] = (usageByService[as.service.id] || 0) + 1;
                        });
                      } else if (item.serviceId) {
                        usageByService[item.serviceId] = (usageByService[item.serviceId] || 0) + 1;
                      }
                    });
                    return (
                      <div className="border border-zinc-100 rounded-xl p-4 mb-5">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Serviços Disponíveis</p>
                        <div className="space-y-2">
                          {extratoSub.plan.planServices.map((ps: any) => {
                            const used = usageByService[ps.service.id] || 0;
                            const limit = ps.quantity;
                            const isUnlimited = limit == null;
                            const isExhausted = !isUnlimited && used >= limit;
                            const pct = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
                            return (
                              <div key={ps.service.id} className="flex items-center justify-between bg-zinc-50 rounded-lg p-3">
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-zinc-800">{ps.service.name}</p>
                                  {!isUnlimited && (
                                    <div className="w-full bg-zinc-200 rounded-full h-1.5 mt-1.5">
                                      <div
                                        className={`h-1.5 rounded-full transition-all ${isExhausted ? "bg-red-500" : "bg-emerald-500"}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ml-3 shrink-0 ${
                                  isUnlimited
                                    ? "bg-blue-50 text-blue-600"
                                    : isExhausted
                                      ? "bg-red-100 text-red-600"
                                      : "bg-emerald-50 text-emerald-700"
                                }`}>
                                  {isUnlimited ? `${used} (∞)` : `${used} / ${limit}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Timeline de Usos</p>
                    {extratoSub.nextBillingDate && (
                      <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full">
                        Fim do ciclo: {formatDate(extratoSub.nextBillingDate)}
                      </span>
                    )}
                  </div>
                  {extratoHistory.length === 0 ? (
                    <div className="text-center py-16">
                      <Clock className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                      <p className="text-zinc-400 font-medium">Nenhum uso registrado neste ciclo.</p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-zinc-100" />
                      <div className="space-y-4">
                        {extratoHistory.map((item: any, i: number) => (
                          <div key={i} className="flex gap-4 relative">
                            <div className="w-9 h-9 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center shrink-0 z-10">
                              <Check className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="flex-1 bg-zinc-50 rounded-xl p-3.5 border border-zinc-100">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-bold text-zinc-900">{item.beneficiaryName || "Titular"}</p>
                                  <p className="text-xs text-primary font-semibold mt-0.5">
                                    {item.services?.length > 0
                                      ? item.services.map((s: any) => s.service.name).join(" + ")
                                      : "Serviço padrão"}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[11px] font-semibold text-zinc-600">{item.barber?.user?.name}</p>
                                  <p className="text-[10px] text-zinc-400">
                                    {new Date(item.date).toLocaleDateString("pt-BR")} às {item.startTime}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* === ABA PAGAMENTOS === */
                <div>
                  {(() => {
                    const payments = extratoSub.payments || [];
                    const totalPaid = payments.filter((p: any) => p.status === "PAID").reduce((s: number, p: any) => s + p.amount, 0);
                    const totalPending = payments.filter((p: any) => p.status === "PENDING").reduce((s: number, p: any) => s + p.amount, 0);
                    const hasPaid = payments.some((p: any) => p.status === "PAID");
                    return (
                      <>
                        {/* Resumo financeiro */}
                        <div className="grid grid-cols-2 gap-3 mb-5">
                          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Total Pago</p>
                            <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(totalPaid)}</p>
                          </div>
                          <div className={`rounded-xl p-4 border ${totalPending > 0 ? "bg-red-50 border-red-100" : "bg-zinc-50 border-zinc-100"}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${totalPending > 0 ? "text-red-600" : "text-zinc-400"}`}>Inadimplência</p>
                            <p className={`text-xl font-bold mt-1 ${totalPending > 0 ? "text-red-700" : "text-zinc-400"}`}>{formatCurrency(totalPending)}</p>
                          </div>
                        </div>
                        {/* Lista de pagamentos */}
                        {payments.length === 0 ? (
                          <div className="text-center py-12">
                            <DollarSign className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                            <p className="text-zinc-400 font-medium">Nenhum registro de pagamento.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {payments.map((p: any, i: number) => (
                              <div key={i} className={`flex items-center justify-between p-3.5 rounded-xl border ${
                                p.status === "PAID"
                                  ? "bg-emerald-50/50 border-emerald-100"
                                  : "bg-red-50/50 border-red-100"
                              }`}>
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                    p.status === "PAID" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"
                                  }`}>
                                    {p.status === "PAID" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-zinc-900">{formatCurrency(p.amount || extratoSub.plan.price)}</p>
                                    <p className="text-[10px] text-zinc-500">
                                      {p.paidAt
                                        ? `Pago em ${new Date(p.paidAt).toLocaleDateString("pt-BR")} via ${METHOD_LABELS[p.method] || p.method}`
                                        : `Criado em ${new Date(p.createdAt).toLocaleDateString("pt-BR")}`
                                      }
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                    p.status === "PAID"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-red-100 text-red-600"
                                  }`}>
                                    {p.status === "PAID" ? "Confirmado" : "Pendente"}
                                  </span>
                                  {p.status === "PAID" && i === payments.findIndex((px: any) => px.status === "PAID") && (
                                    <button
                                      onClick={() => handleUndoPayment(extratoSub.id)}
                                      disabled={extratoLoading}
                                      className="text-[10px] font-semibold text-zinc-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition-all disabled:opacity-40"
                                      title="Desfazer baixa"
                                    >
                                      <RotateCcw className="w-3 h-3" /> Desfazer
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Botão dar baixa se há pendências */}
                        {isOverdue(extratoSub.nextBillingDate) && extratoSub.status === "ACTIVE" && (
                          <div className="mt-5 pt-4 border-t border-zinc-100">
                            <p className="text-xs font-bold text-zinc-500 mb-3">Registrar pagamento recebido:</p>
                            <div className="grid grid-cols-4 gap-2">
                              {PAYMENT_OPTIONS.map(({ value, label, icon: Icon, color }) => (
                                <button
                                  key={value}
                                  onClick={() => handleExtratoPayment(extratoSub.id, value)}
                                  disabled={extratoLoading}
                                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all hover:scale-105 ${color} disabled:opacity-40`}
                                >
                                  <Icon className="w-5 h-5" />
                                  <span className="text-[10px] font-bold">{label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-100">
              <button onClick={() => setExtratoSub(null)} className="w-full py-3 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => { setOpen(false); setClientSuggestions([]); }} title="Novo Assinante">
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Nome do cliente</label>
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
                      onPointerDown={() => selectClientSuggestion(c)}
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
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              E-mail do cliente
              {" "}<span className="text-zinc-400 font-normal">(recomendado para cobrança automática)</span>
            </label>
            <input
              type="email"
              value={form.clientEmail}
              onChange={(e) => setField("clientEmail", e.target.value)}
              placeholder="Ex: cliente@gmail.com"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              Necessário para ativar o débito automático pelo Mercado Pago.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Plano</label>
            <select value={form.planId} onChange={(e) => setField("planId", e.target.value)} required className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Selecione um plano...</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}/mês</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Dia de vencimento <span className="text-zinc-400 font-normal">(opcional)</span></label>
            <select value={form.billingDay} onChange={(e) => setField("billingDay", e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Sem dia fixo</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>Dia {d}</option>
              ))}
            </select>
            <p className="text-[11px] text-zinc-400 mt-1">Quando definido, a próxima cobrança sempre cai neste dia do mês.</p>
          </div>
          <Button type="submit" loading={loading} className="w-full mt-2">Registrar Assinante</Button>
        </form>
      </Modal>
    </div>
  );
}
