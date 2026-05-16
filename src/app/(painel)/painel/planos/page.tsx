"use client";
import { useEffect, useState } from "react";
import { Layers, Plus, Check, Pencil, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";

interface Service { id: string; name: string; price: number }
interface Plan {
  id: string; name: string; description: string | null; price: number; billingCycle: string; maxUses: number | null; active: boolean;
  planServices: { service: Service }[];
  beneficiaryRules?: any;
}

const CYCLES: Record<string, string> = { MONTHLY: "Mensal", QUARTERLY: "Trimestral", YEARLY: "Anual" };
const EMPTY_FORM = { name: "", description: "", price: "", billingCycle: "MONTHLY", maxUses: "", serviceIds: [] as string[], beneficiaryRules: [] as {name: string, maxUses: string}[] };

export default function PlanosPage() {
  const { token } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function setField(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }

  async function load() {
    const [pr, sr] = await Promise.all([
      fetch("/api/barbershop/plans", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/barbershop/services", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [pd, sd] = await Promise.all([pr.json(), sr.json()]);
    setPlans((pd.plans || []).filter((p: Plan) => p.active));
    setServices(sd.services || []);
  }

  useEffect(() => { load(); }, []);

  function toggleService(id: string) {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((s) => s !== id) : [...f.serviceIds, id],
    }));
  }

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(p: Plan) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      billingCycle: p.billingCycle,
      maxUses: p.maxUses != null ? String(p.maxUses) : "",
      serviceIds: p.planServices.map((ps) => ps.service.id),
      beneficiaryRules: Array.isArray(p.beneficiaryRules) ? p.beneficiaryRules.map((b: any) => ({ name: b.name, maxUses: String(b.maxUses) })) : [],
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const url = editingId ? `/api/barbershop/plans/${editingId}` : "/api/barbershop/plans";
    const method = editingId ? "PUT" : "POST";
    const payload = {
      ...form,
      beneficiaryRules: form.beneficiaryRules.length > 0 ? form.beneficiaryRules.map(b => ({ name: b.name, maxUses: Number(b.maxUses) })) : null
    };
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      const data = await res.json();
      alert(`Erro ao salvar plano: ${data.error}`);
      setLoading(false);
      return;
    }
    setLoading(false);
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    load();
  }

  async function handleDelete(p: Plan) {
    if (!confirm(`Excluir o plano "${p.name}"? Assinantes ativos não serão afetados, mas o plano deixará de aparecer aqui.`)) return;
    await fetch(`/api/barbershop/plans/${p.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Planos de Assinatura</h1>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Novo Plano
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400 bg-white rounded-xl border border-zinc-100">
          <Layers className="w-12 h-12 mb-3" />
          <p className="font-medium">Crie seu primeiro plano de assinatura</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-zinc-100 shadow-sm p-5 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(p)}
                  className="p-1.5 rounded-md text-zinc-400 hover:text-amber-600 hover:bg-amber-50"
                  title="Editar plano"
                  aria-label="Editar plano"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50"
                  title="Excluir plano"
                  aria-label="Excluir plano"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="font-bold text-zinc-900 text-lg mt-1 pr-16">{p.name}</p>
              {p.description && <p className="text-xs text-zinc-400 mb-3">{p.description}</p>}
              <p className="text-3xl font-bold text-amber-500 mt-2">{formatCurrency(p.price)}<span className="text-sm font-normal text-zinc-400">/{CYCLES[p.billingCycle]?.toLowerCase()}</span></p>
              {p.maxUses && <p className="text-xs text-zinc-500 mt-1">Até {p.maxUses} usos/mês</p>}
              {p.planServices.length > 0 && (
                <ul className="mt-4 space-y-1">
                  {p.planServices.map(({ service }) => (
                    <li key={service.id} className="flex items-center gap-2 text-sm text-zinc-700">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      {service.name}
                    </li>
                  ))}
                </ul>
              )}
              {Array.isArray(p.beneficiaryRules) && p.beneficiaryRules.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-100">
                  <p className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Dependências</p>
                  <ul className="space-y-1">
                    {p.beneficiaryRules.map((b: any, i: number) => (
                      <li key={i} className="flex justify-between items-center text-xs text-zinc-600 bg-zinc-50 rounded p-1.5 px-2">
                        <span>{b.name}</span>
                        <span className="font-semibold text-zinc-800">{b.maxUses} usos</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? "Editar Plano" : "Novo Plano"} className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input label="Nome do plano" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ex: Plano Premium" required />
          <Input label="Descrição" value={form.description} onChange={(e) => setField("description", e.target.value)} />
          <Input label="Preço (R$)" type="number" step="0.01" value={form.price} onChange={(e) => setField("price", e.target.value)} required />
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Ciclo de cobrança</label>
            <select value={form.billingCycle} onChange={(e) => setField("billingCycle", e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="MONTHLY">Mensal</option>
              <option value="QUARTERLY">Trimestral</option>
              <option value="YEARLY">Anual</option>
            </select>
          </div>
          <Input label="Máx. usos por mês (vazio = ilimitado)" type="number" min="1" value={form.maxUses} onChange={(e) => setField("maxUses", e.target.value)} />
          
          <div className="border border-zinc-200 p-3 rounded-lg bg-zinc-50">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-zinc-700">Dependentes (Ex: Pai e Filho)</label>
              <button 
                type="button" 
                onClick={() => setField("beneficiaryRules", [...form.beneficiaryRules, { name: "", maxUses: "" }])}
                className="text-xs text-amber-600 font-medium hover:text-amber-700 flex items-center"
              >
                <Plus className="w-3 h-3 mr-1" /> Add
              </button>
            </div>
            {form.beneficiaryRules.length === 0 && (
              <p className="text-[11px] text-zinc-500">Deixe vazio para planos individuais. Adicione para planos com múltiplos limites (Pai, Filho, etc).</p>
            )}
            <div className="space-y-2 mt-2">
              {form.beneficiaryRules.map((b, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input placeholder="Ex: Pai" value={b.name} onChange={e => { const newB = [...form.beneficiaryRules]; newB[i].name = e.target.value; setField("beneficiaryRules", newB); }} className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none" required />
                  <input placeholder="Usos" type="number" min="1" value={b.maxUses} onChange={e => { const newB = [...form.beneficiaryRules]; newB[i].maxUses = e.target.value; setField("beneficiaryRules", newB); }} className="w-16 rounded border border-zinc-300 px-2 py-1.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none" required />
                  <button type="button" onClick={() => setField("beneficiaryRules", form.beneficiaryRules.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          {services.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Serviços inclusos</label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {services.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-zinc-50 rounded p-1">
                    <input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} className="rounded text-amber-500" />
                    <span className="text-sm text-zinc-700">{s.name}</span>
                    <span className="text-xs text-zinc-400 ml-auto">{formatCurrency(s.price)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <Button type="submit" loading={loading} className="w-full mt-2">{editingId ? "Salvar Alterações" : "Criar Plano"}</Button>
        </form>
      </Modal>
    </div>
  );
}
