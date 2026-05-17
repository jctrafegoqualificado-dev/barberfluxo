"use client";
import { useEffect, useState } from "react";
import { CreditCard, Plus, Search, Banknote, Smartphone, AlertTriangle, Check, X, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";

interface Subscription {
  id: string; status: string; startDate: string; nextBillingDate: string; usesThisCycle: number;
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

export default function AssinaturasPage() {
  const { token } = useAuthStore();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [paymentSub, setPaymentSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "overdue">("all");
  const [form, setForm] = useState({ clientName: "", clientPhone: "", planId: "" });
  const [usageModal, setUsageModal] = useState<Subscription | null>(null);
  const [historyModal, setHistoryModal] = useState<Subscription | null>(null);
  const [historyItems, setHistoryItems] = useState<any[]>([]);

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

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
      setForm({ clientName: "", clientPhone: "", planId: "" });
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

  async function loadHistory(s: any) {
    setHistoryModal(s);
    setLoading(true);
    try {
      const res = await fetch(`/api/barbershop/subscriptions/${s.id}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHistoryItems(data.history || []);
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

  const overdueSubs = subs.filter((s) => s.status === "ACTIVE" && isOverdue(s.nextBillingDate));

  const filtered = subs
    .filter((s) => filter === "overdue" ? (s.status === "ACTIVE" && isOverdue(s.nextBillingDate)) : true)
    .filter((s) =>
      s.client.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.client.phone ?? "").includes(search)
    );

  return (
    <div className="space-y-6">
      {paymentSub && (
        <PaymentModal sub={paymentSub} onConfirm={handlePayment} onClose={() => setPaymentSub(null)} />
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

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-sm font-medium">
          <button onClick={() => setFilter("all")} className={`px-3 py-2 transition-colors ${filter === "all" ? "bg-primary text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}>Todos</button>
          <button onClick={() => setFilter("overdue")} className={`px-3 py-2 flex items-center gap-1 transition-colors ${filter === "overdue" ? "bg-red-500 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}>
            <AlertTriangle className="w-3.5 h-3.5" /> Vencidos {overdueSubs.length > 0 && `(${overdueSubs.length})`}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-zinc-400">
            <CreditCard className="w-12 h-12 mb-3" />
            <p className="font-medium">Nenhum assinante encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {filtered.map((s) => {
              const overdue = s.status === "ACTIVE" && isOverdue(s.nextBillingDate);
              const lastPaid = s.payments.find((p) => p.status === "PAID");

              return (
                <div key={s.id} className={`px-6 py-4 flex items-center gap-4 ${overdue ? "bg-red-50 border-l-4 border-red-400" : ""}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${overdue ? "bg-red-100" : "bg-primary/20"}`}>
                    <span className={`font-bold text-xs ${overdue ? "text-red-700" : "text-amber-700"}`}>{getInitials(s.client.name)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold truncate ${overdue ? "text-red-800" : "text-zinc-900"}`}>{s.client.name}</p>
                      {overdue && (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Vencido
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">{s.client.email}</p>
                    {lastPaid && (
                      <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Último pagamento: {METHOD_LABELS[lastPaid.method] ?? lastPaid.method} · {lastPaid.paidAt ? new Date(lastPaid.paidAt).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    )}
                  </div>

                  <div className="text-center hidden sm:block">
                    <p className="text-xs text-zinc-400">Plano</p>
                    <p className="text-sm font-medium text-zinc-700">{s.plan.name}</p>
                  </div>

                  <div className="text-center hidden md:block">
                    <p className="text-xs text-zinc-400">Valor</p>
                    <p className="text-sm font-bold text-zinc-900">{formatCurrency(s.plan.price)}/mês</p>
                  </div>

                  <div className="text-center hidden md:block">
                    <p className="text-xs text-zinc-400">Usos no Mês</p>
                    {Array.isArray(s.beneficiaries) && s.beneficiaries.length > 0 ? (
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {s.beneficiaries.map((b: any, idx: number) => (
                          <p key={idx} className="text-[11px] font-medium text-zinc-700 whitespace-nowrap">
                            <span className="text-zinc-500">{b.name}:</span> {b.uses}/{b.maxUses}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-zinc-700 mt-0.5">
                        {s.usesThisCycle}{s.plan.maxUses ? `/${s.plan.maxUses}` : ""}
                      </p>
                    )}
                  </div>

                  <div className="text-center hidden lg:block">
                    <p className={`text-xs ${overdue ? "text-red-500 font-semibold" : "text-zinc-400"}`}>
                      {overdue ? "Venceu em" : "Próx. cobrança"}
                    </p>
                    <p className={`text-xs ${overdue ? "text-red-600 font-bold" : "text-zinc-600"}`}>{formatDate(s.nextBillingDate)}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Badge status={s.status} />
                    <div className="flex gap-2">
                      {s.status === "ACTIVE" && (
                        <button
                          onClick={() => setUsageModal(s)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap"
                        >
                          Lançar uso
                        </button>
                      )}
                      {overdue && (
                        <button
                          onClick={() => setPaymentSub(s)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors whitespace-nowrap"
                        >
                          Dar baixa (Pagto)
                        </button>
                      )}
                      <button
                        onClick={() => loadHistory(s)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-zinc-200 text-zinc-600 font-semibold hover:bg-zinc-50 transition-colors whitespace-nowrap"
                      >
                        Ver Histórico
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                        title="Excluir assinatura"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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

      {/* Modal de Histórico de Uso */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h2 className="font-semibold text-zinc-900">Histórico de Usos: {historyModal.client.name}</h2>
              <button onClick={() => setHistoryModal(null)} className="p-1 rounded-lg hover:bg-zinc-100"><X className="w-4 h-4 text-zinc-500" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {loading ? (
                <p className="text-center py-10 text-zinc-500">Carregando histórico...</p>
              ) : historyItems.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-zinc-400">Nenhum uso registrado neste ciclo.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                      <div>
                        <p className="font-bold text-zinc-900 leading-tight">{item.beneficiaryName || "Titular"}</p>
                        <p className="text-[11px] text-primary/90 font-semibold mb-1">
                          {item.services?.length > 0 
                            ? item.services.map((s: any) => s.service.name).join(" + ") 
                            : "Serviço padrão"}
                        </p>
                        <p className="text-xs text-zinc-400">{new Date(item.date).toLocaleDateString("pt-BR")} às {item.startTime}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-zinc-600">Barbeiro: {item.barber.user.name}</p>
                        <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest">Plano Utilizado</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-zinc-50">
              <button onClick={() => setHistoryModal(null)} className="w-full py-3 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800">Fechar</button>
            </div>
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Novo Assinante">
        <form onSubmit={handleAdd} className="space-y-3">
          <Input label="Nome do cliente" value={form.clientName} onChange={(e) => setField("clientName", e.target.value)} required />
          <Input label="WhatsApp" type="tel" value={form.clientPhone} onChange={(e) => setField("clientPhone", e.target.value)} required />
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Plano</label>
            <select value={form.planId} onChange={(e) => setField("planId", e.target.value)} required className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Selecione um plano...</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}/mês</option>)}
            </select>
          </div>
          <Button type="submit" loading={loading} className="w-full mt-2">Registrar Assinante</Button>
        </form>
      </Modal>
    </div>
  );
}
