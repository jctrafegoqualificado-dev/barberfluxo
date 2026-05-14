"use client";
import { useEffect, useState } from "react";
import { Scissors, Plus, Clock, DollarSign, Edit } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";

interface Service {
  id: string; name: string; description: string | null; price: number; duration: number; active: boolean;
}

export default function ServicosPage() {
  const { token } = useAuthStore();
  const [services, setServices] = useState<Service[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", duration: "30" });

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function openNew() {
    setEditingId(null);
    setForm({ name: "", description: "", price: "", duration: "30" });
    setOpen(true);
  }

  function openEdit(s: Service) {
    setEditingId(s.id);
    setForm({ name: s.name, description: s.description || "", price: s.price.toString(), duration: s.duration.toString() });
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
    
    if (editingId) {
      const existing = services.find((s) => s.id === editingId);
      await fetch(`/api/barbershop/services/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, active: existing?.active ?? true }),
      });
    } else {
      await fetch("/api/barbershop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Serviços</h1>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Novo Serviço
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <div key={s.id} className={`bg-white rounded-xl border shadow-sm p-5 ${!s.active ? "opacity-50" : "border-zinc-100"}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <Scissors className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Editar serviço">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => toggleActive(s)} className={`text-xs px-2 py-1 rounded-full font-medium ${s.active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-500"}`}>
                  {s.active ? "Ativo" : "Inativo"}
                </button>
              </div>
            </div>
            <p className="font-semibold text-zinc-900 mb-1">{s.name}</p>
            {s.description && <p className="text-xs text-zinc-400 mb-3">{s.description}</p>}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1 text-zinc-500">
                <Clock className="w-3.5 h-3.5" />
                <span>{s.duration} min</span>
              </div>
              <div className="flex items-center gap-1 font-bold text-zinc-900">
                <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                <span>{formatCurrency(s.price)}</span>
              </div>
            </div>
          </div>
        ))}

        <button onClick={openNew} className="border-2 border-dashed border-zinc-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-zinc-400 hover:border-amber-400 hover:text-amber-500 transition-colors min-h-[140px]">
          <Plus className="w-8 h-8" />
          <span className="text-sm font-medium">Novo Serviço</span>
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? "Editar Serviço" : "Novo Serviço"}>
        <form onSubmit={handleAdd} className="space-y-3">
          <Input label="Nome do serviço" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ex: Corte degradê" required />
          <Input label="Descrição (opcional)" value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Detalhes do serviço..." />
          <Input label="Preço (R$)" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setField("price", e.target.value)} placeholder="45.00" required />
          <Input label="Duração (minutos)" type="number" min="15" step="15" value={form.duration} onChange={(e) => setField("duration", e.target.value)} required />
          <Button type="submit" loading={loading} className="w-full mt-2">{editingId ? "Salvar Alterações" : "Criar Serviço"}</Button>
        </form>
      </Modal>
    </div>
  );
}
