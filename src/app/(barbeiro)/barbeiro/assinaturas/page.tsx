"use client";
import { useEffect, useState } from "react";
import { CreditCard, Plus, Search, X, AlertTriangle, Check, Users } from "lucide-react";
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

function isOverdue(nextBillingDate: string) {
  return new Date(nextBillingDate) <= new Date();
}

export default function BarberAssinaturasPage() {
  const { token } = useAuthStore();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ clientName: "", clientPhone: "", planId: "", billingDay: "" });

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

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

  const overdueSubs = subs.filter((s) => s.status === "ACTIVE" && isOverdue(s.nextBillingDate));

  const filtered = subs.filter((s) =>
    s.client.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.client.phone ?? "").includes(search)
  );

  return (
    <div className="space-y-6">
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white text-zinc-800"
        />
      </div>

      {pageLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-100 p-5 animate-pulse space-y-3">
              <div className="h-4 bg-zinc-100 rounded w-2/3" />
              <div className="h-3 bg-zinc-100 rounded w-1/2" />
              <div className="h-3 bg-zinc-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-zinc-400 bg-white rounded-xl border border-zinc-100">
          <Users className="w-12 h-12 mb-3" />
          <p className="font-medium">Nenhum assinante encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((s) => {
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
              </div>
            );
          })}
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
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Dia de vencimento <span className="text-zinc-400 font-normal">(opcional)</span></label>
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
