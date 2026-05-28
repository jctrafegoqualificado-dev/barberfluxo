"use client";
import { useEffect, useState } from "react";
import { Sparkles, Plus, Clock, DollarSign, Edit, Percent, HelpCircle, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  active: boolean;
  imageUrl: string | null;
  commission: number | null;
  materialCost: number;
}

export default function ServicosPage() {
  const { token } = useAuthStore();
  const [services, setServices] = useState<Service[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    duration: "30",
    imageUrl: "",
    commission: "",
    materialCost: "0"
  });

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function openNew() {
    setEditingId(null);
    setForm({
      name: "",
      description: "",
      price: "",
      duration: "30",
      imageUrl: "",
      commission: "",
      materialCost: "0"
    });
    setOpen(true);
  }

  function openEdit(s: Service) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description || "",
      price: s.price.toString(),
      duration: s.duration.toString(),
      imageUrl: s.imageUrl || "",
      commission: s.commission !== null && s.commission !== undefined ? s.commission.toString() : "",
      materialCost: s.materialCost.toString()
    });
    setOpen(true);
  }

  async function load() {
    const r = await fetch("/api/barbershop/services", { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    setServices(d.services || []);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    const payload = {
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      duration: parseInt(form.duration),
      imageUrl: form.imageUrl || null,
      commission: form.commission !== "" ? parseFloat(form.commission) : null,
      materialCost: parseFloat(form.materialCost || "0")
    };

    if (editingId) {
      const existing = services.find((s) => s.id === editingId);
      await fetch(`/api/barbershop/services/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...payload, active: existing?.active ?? true }),
      });
    } else {
      await fetch("/api/barbershop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
    }
    
    setLoading(false);
    setOpen(false);
    load();
  }

  async function toggleActive(s: Service) {
    await fetch(`/api/barbershop/services/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...s, active: !s.active }),
    });
    load();
  }

  async function handleDelete(s: Service) {
    if (!confirm(`Excluir "${s.name}"? O serviço será desativado permanentemente.`)) return;
    await fetch(`/api/barbershop/services/${s.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Serviços</h1>
          <p className="text-zinc-500 text-xs mt-0.5">Gerencie os tratamentos, custos de insumos e comissões da equipe.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Novo Serviço
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <div key={s.id} className={`bg-white rounded-2xl border shadow-sm p-5 relative overflow-hidden flex flex-col justify-between min-h-[220px] transition-all hover:shadow-md ${!s.active ? "opacity-50" : "border-zinc-200"}`}>
            {s.imageUrl && (
              <div className="absolute top-0 right-0 w-24 h-24 opacity-10 pointer-events-none">
                <img src={s.imageUrl} alt="" className="w-full h-full object-cover rounded-bl-full" />
              </div>
            )}
            
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-zinc-400 hover:text-primary hover:bg-primary/10 transition-colors" title="Editar serviço">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleActive(s)} className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${s.active ? "bg-green-50 text-green-700 border border-green-200" : "bg-zinc-100 text-zinc-500 border border-zinc-200"}`}>
                    {s.active ? "Ativo" : "Inativo"}
                  </button>
                  <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Excluir serviço">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <p className="font-bold text-zinc-950 text-base mb-1">{s.name}</p>
              {s.description && <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{s.description}</p>}
            </div>

            <div className="space-y-2 mt-4 pt-3 border-t border-zinc-100 text-sm">
              <div className="flex justify-between items-center text-zinc-500">
                <span className="flex items-center gap-1.5 text-xs"><Clock className="w-3.5 h-3.5" /> Duração</span>
                <span className="font-semibold text-zinc-700">{s.duration} min</span>
              </div>
              {s.materialCost > 0 && (
                <div className="flex justify-between items-center text-red-500">
                  <span className="flex items-center gap-1.5 text-xs"><DollarSign className="w-3.5 h-3.5" /> Custo Insumo</span>
                  <span className="font-bold text-xs">-{formatCurrency(s.materialCost)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-zinc-500">
                <span className="flex items-center gap-1.5 text-xs"><Percent className="w-3.5 h-3.5" /> Comissão</span>
                <span className="font-semibold text-zinc-700 text-xs">
                  {s.commission !== null ? `${s.commission}%` : "Geral do Profissional"}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-zinc-50">
                <span className="text-xs font-semibold text-zinc-500">Preço Final</span>
                <span className="font-extrabold text-zinc-950 text-base">{formatCurrency(s.price)}</span>
              </div>
            </div>
          </div>
        ))}

        <button onClick={openNew} className="border-2 border-dashed border-zinc-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-zinc-400 hover:border-primary/80 hover:text-primary transition-colors min-h-[220px]">
          <Plus className="w-8 h-8" />
          <span className="text-sm font-semibold">Novo Serviço</span>
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? "Editar Serviço" : "Novo Serviço"}>
        <form onSubmit={handleAdd} className="space-y-4">
          <Input label="Nome do serviço" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ex: Progressiva, Botox, Manicure" required />
          <Input label="Descrição (opcional)" value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Detalhes do serviço..." />
          <Input label="URL da Foto do Serviço (opcional)" value={form.imageUrl} onChange={(e) => setField("imageUrl", e.target.value)} placeholder="https://exemplo.com/foto.jpg" />
          
          <div className="grid grid-cols-2 gap-4">
            <Input label="Preço de Venda (R$)" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setField("price", e.target.value)} placeholder="150.00" required />
            <Input label="Duração (minutos)" type="number" min="5" step="5" value={form.duration} onChange={(e) => setField("duration", e.target.value)} required />
          </div>

          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-150 space-y-4">
            <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-primary" /> Regras Financeiras Avançadas
            </h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1">
                  Custo de Insumo / Química (R$)
                  <span className="group relative cursor-help text-zinc-400 hover:text-zinc-600">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:block w-48 bg-zinc-950 text-white text-[10px] p-2 rounded-lg leading-tight shadow-xl z-50">
                      O valor do insumo/química será deduzido do preço total antes do cálculo de comissão do profissional.
                    </span>
                  </span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.materialCost}
                  onChange={(e) => setField("materialCost", e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="0.00 (Ex: R$ 30,00 de química)"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1">
                  Comissão Especial do Serviço (%)
                  <span className="group relative cursor-help text-zinc-400 hover:text-zinc-600">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:block w-48 bg-zinc-950 text-white text-[10px] p-2 rounded-lg leading-tight shadow-xl z-50">
                      Deixe em branco para usar a porcentagem padrão que o profissional já tem configurada no perfil dele.
                    </span>
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.commission}
                  onChange={(e) => setField("commission", e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Ex: 40 (Opcional)"
                />
              </div>
            </div>
          </div>

          <Button type="submit" loading={loading} className="w-full">{editingId ? "Salvar Alterações" : "Criar Serviço"}</Button>
        </form>
      </Modal>
    </div>
  );
}
