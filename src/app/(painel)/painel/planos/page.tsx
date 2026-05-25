"use client";
import { useEffect, useState } from "react";
import { Layers, Plus, Check, Pencil, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";

interface Service { id: string; name: string; price: number }
interface Barber { id: string; nickname: string | null; user: { name: string } }
interface Plan {
  id: string; name: string; description: string | null; price: number; billingCycle: string; maxUses: number | null; active: boolean; commissionPercentage?: number | null; extraDiscount?: number;
  planServices: { service: Service; quantity: number | null }[];
  allowedBarbers?: Barber[];
  beneficiaryRules?: any;
  _count?: { subscriptions: number };
}

const CYCLES: Record<string, string> = { MONTHLY: "Mensal", QUARTERLY: "Trimestral", YEARLY: "Anual" };
const EMPTY_FORM = { name: "", description: "", price: "", commissionPercentage: "", extraDiscount: "0", billingCycle: "MONTHLY", maxUses: "", serviceQuantities: [] as {serviceId: string, quantity: string, unlimited: boolean}[], beneficiaryRules: [] as {name: string, maxUses: string}[], allowedBarberIds: [] as string[] };

export default function PlanosPage() {
  const { token } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function setField(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }

  async function load() {
    const [pr, sr, br] = await Promise.all([
      fetch("/api/barbershop/plans", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/barbershop/services", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/barbershop/barbers", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [pd, sd, bd] = await Promise.all([pr.json(), sr.json(), br.json()]);
    setPlans((pd.plans || []).filter((p: Plan) => p.active));
    setServices(sd.services || []);
    setBarbers(bd.barbers || []);
  }

  useEffect(() => { load(); }, []);

  function toggleService(id: string) {
    setForm((f) => {
      const exists = f.serviceQuantities.find(sq => sq.serviceId === id);
      if (exists) {
        return { ...f, serviceQuantities: f.serviceQuantities.filter(sq => sq.serviceId !== id) };
      }
      return { ...f, serviceQuantities: [...f.serviceQuantities, { serviceId: id, quantity: "", unlimited: true }] };
    });
  }

  function updateServiceQty(serviceId: string, field: string, value: any) {
    setForm((f) => ({
      ...f,
      serviceQuantities: f.serviceQuantities.map(sq =>
        sq.serviceId === serviceId
          ? { ...sq, [field]: value, ...(field === "unlimited" && value ? { quantity: "" } : {}) }
          : sq
      ),
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
      commissionPercentage: p.commissionPercentage != null ? String(p.commissionPercentage) : "",
      extraDiscount: p.extraDiscount != null ? String(p.extraDiscount) : "0",
      billingCycle: p.billingCycle,
      maxUses: p.maxUses != null ? String(p.maxUses) : "",
      serviceQuantities: p.planServices.map((ps) => ({
        serviceId: ps.service.id,
        quantity: ps.quantity != null ? String(ps.quantity) : "",
        unlimited: ps.quantity == null,
      })),
      beneficiaryRules: Array.isArray(p.beneficiaryRules) ? p.beneficiaryRules.map((b: any) => ({ name: b.name, maxUses: String(b.maxUses) })) : [],
      allowedBarberIds: p.allowedBarbers?.map((b) => b.id) || [],
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
      commissionPercentage: form.commissionPercentage === "" ? null : Number(form.commissionPercentage),
      extraDiscount: form.extraDiscount === "" ? 0 : Math.min(100, Math.max(0, Number(form.extraDiscount))),
      serviceQuantities: form.serviceQuantities.map(sq => ({
        serviceId: sq.serviceId,
        quantity: sq.unlimited ? null : (sq.quantity ? Number(sq.quantity) : null),
      })),
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
              <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(p)}
                  className="p-1.5 rounded-md text-zinc-400 hover:text-primary/90 hover:bg-primary/10"
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
              <div className="flex items-baseline justify-between mt-2 flex-wrap gap-2">
                <p className="text-3xl font-bold text-primary">{formatCurrency(p.price)}<span className="text-sm font-normal text-zinc-400">/{CYCLES[p.billingCycle]?.toLowerCase()}</span></p>
                {p._count?.subscriptions != null && p._count.subscriptions > 0 && (
                  <span className="text-[11px] font-bold text-zinc-600 bg-zinc-50 border border-zinc-100 px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    <Layers className="w-3 h-3 text-primary" /> {p._count.subscriptions} ativa{p._count.subscriptions === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {p.maxUses && <p className="text-xs text-zinc-500">Até {p.maxUses} usos/mês</p>}
                {p.commissionPercentage != null && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {p.commissionPercentage}% de comissão
                  </span>
                )}
                {p.extraDiscount != null && p.extraDiscount > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {p.extraDiscount}% off extras
                  </span>
                )}
              </div>
              {p.planServices.length > 0 && (
                <ul className="mt-4 space-y-1">
                  {p.planServices.map(({ service, quantity }) => (
                    <li key={service.id} className="flex items-center gap-2 text-sm text-zinc-700">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      {quantity != null ? (
                        <><span className="font-bold text-primary">{quantity}x</span> {service.name}</>
                      ) : (
                        <>{service.name} <span className="text-[10px] text-zinc-400 ml-1">(ilimitado)</span></>
                      )}
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
          <div className="grid grid-cols-2 gap-3">
            <Input label="Preço (R$)" type="number" step="0.01" value={form.price} onChange={(e) => setField("price", e.target.value)} required />
            <Input label="Comissão Prof. (%)" type="number" step="0.1" value={form.commissionPercentage} onChange={(e) => setField("commissionPercentage", e.target.value)} placeholder="Ex: 20" />
          </div>
          <p className="text-[11px] text-zinc-500 leading-tight">
            <strong>Dica:</strong> Se vazio, o barbeiro recebe o <strong className="text-zinc-700">Ticket Médio (Rateio)</strong> da barbearia. Se preenchido (ex: 20%), ele recebe esse % sobre o valor de tabela do serviço e <strong>sai do Rateio</strong>.
          </p>

          <div className="border border-amber-100 bg-amber-50/50 rounded-xl p-3">
            <label className="block text-sm font-semibold text-zinc-700 mb-1">Desconto automático em extras (%)</label>
            <p className="text-[11px] text-zinc-500 mb-2 leading-tight">
              Quando o assinante deste plano realizar um serviço <strong>não coberto</strong>, o sistema pré-preenche este desconto na comanda automaticamente. O barbeiro pode reduzir ou zerar — nunca ultrapassar o teto configurado nas Configurações.
              <br /><strong>0 = sem desconto automático</strong>.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" max="100" step="1"
                value={form.extraDiscount}
                onChange={(e) => setField("extraDiscount", e.target.value)}
                className="w-20 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-center font-semibold"
              />
              <span className="text-zinc-400 text-sm">%</span>
              {Number(form.extraDiscount) > 0 && (
                <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full font-medium">
                  Assinante ganha {form.extraDiscount}% off nos extras
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Ciclo de cobrança</label>
            <select value={form.billingCycle} onChange={(e) => setField("billingCycle", e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
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
                className="text-xs text-primary/90 font-medium hover:text-amber-700 flex items-center"
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
                  <input placeholder="Ex: Pai" value={b.name} onChange={e => { const newB = [...form.beneficiaryRules]; newB[i].name = e.target.value; setField("beneficiaryRules", newB); }} className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary focus:outline-none" required />
                  <input placeholder="Usos" type="number" min="1" value={b.maxUses} onChange={e => { const newB = [...form.beneficiaryRules]; newB[i].maxUses = e.target.value; setField("beneficiaryRules", newB); }} className="w-16 rounded border border-zinc-300 px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary focus:outline-none" required />
                  <button type="button" onClick={() => setField("beneficiaryRules", form.beneficiaryRules.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          {barbers.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1">Profissionais Permitidos</label>
              <p className="text-[11px] text-zinc-500 mb-2 leading-tight">
                Selecione quais barbeiros podem realizar atendimentos por este plano. Se deixar vazio, todos poderão atender.
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {barbers.map((b) => {
                  const isSelected = form.allowedBarberIds.includes(b.id);
                  return (
                    <label key={b.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-zinc-200 hover:border-zinc-300"}`}>
                      <input 
                        type="checkbox" 
                        className="rounded text-primary focus:ring-primary"
                        checked={isSelected}
                        onChange={() => {
                          setForm((f) => {
                            if (isSelected) {
                              return { ...f, allowedBarberIds: f.allowedBarberIds.filter(id => id !== b.id) };
                            }
                            return { ...f, allowedBarberIds: [...f.allowedBarberIds, b.id] };
                          });
                        }}
                      />
                      <span className="text-sm text-zinc-800">{b.nickname || b.user.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {services.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-2">Serviços inclusos</label>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {services.map((s) => {
                  const sq = form.serviceQuantities.find(sq => sq.serviceId === s.id);
                  const isSelected = !!sq;
                  return (
                    <div key={s.id} className={`rounded-xl border p-3 transition-all ${isSelected ? "border-primary bg-primary/5" : "border-zinc-200 hover:border-zinc-300"}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleService(s.id)} className="rounded text-primary" />
                        <span className="text-sm font-medium text-zinc-800 flex-1">{s.name}</span>
                        <span className="text-xs text-zinc-400">{formatCurrency(s.price)}</span>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-3 mt-2 pl-6">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sq.unlimited}
                              onChange={(e) => updateServiceQty(s.id, "unlimited", e.target.checked)}
                              className="rounded text-primary"
                            />
                            <span className="text-xs font-medium text-zinc-600">Ilimitado</span>
                          </label>
                          {!sq.unlimited && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-zinc-500">Qtd:</span>
                              <input
                                type="number"
                                min="1"
                                value={sq.quantity}
                                onChange={(e) => updateServiceQty(s.id, "quantity", e.target.value)}
                                placeholder="Ex: 4"
                                className="w-16 rounded border border-zinc-300 px-2 py-1 text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                                required
                              />
                              <span className="text-[10px] text-zinc-400">usos/ciclo</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <Button type="submit" loading={loading} className="w-full mt-2">{editingId ? "Salvar Alterações" : "Criar Plano"}</Button>
        </form>
      </Modal>
    </div>
  );
}
