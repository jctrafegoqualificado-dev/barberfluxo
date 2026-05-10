"use client";
import { useEffect, useState } from "react";
import { Layers, Plus, Check } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";

interface Service { id: string; name: string; price: number }
interface Plan {
  id: string; name: string; description: string | null; price: number; billingCycle: string; maxUses: number | null; active: boolean;
  planServices: { service: Service }[];
}

const CYCLES: Record<string, string> = { MONTHLY: "Mensal", QUARTERLY: "Trimestral", YEARLY: "Anual" };

export default function PlanosPage() {
  const { token } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", price: "", billingCycle: "MONTHLY", maxUses: "", serviceIds: [] as string[] });

  function setField(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }

  async function load() {
    const [pr, sr] = await Promise.all([
      fetch("/api/barbershop/plans", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/barbershop/services", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [pd, sd] = await Promise.all([pr.json(), sr.json()]);
    setPlans(pd.plans || []);
    setServices(sd.services || []);
  }

  useEffect(() => { load(); }, []);

  function toggleService(id: string) {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((s) => s !== id) : [...f.serviceIds, id],
    }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/barbershop/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    setLoading(false);
    setOpen(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Planos de Assinatura</h1>
        <Button onClick={() => setOpen(true)}>
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
            <div key={p.id} className="bg-white rounded-xl border border-zinc-100 shadow-sm p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />
              <p className="font-bold text-zinc-900 text-lg mt-1">{p.name}</p>
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
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Novo Plano" className="max-w-lg">
        <form onSubmit={handleAdd} className="space-y-3">
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
          <Button type="submit" loading={loading} className="w-full mt-2">Criar Plano</Button>
        </form>
      </Modal>
    </div>
  );
}
