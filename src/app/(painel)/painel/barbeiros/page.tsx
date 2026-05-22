"use client";
import { useEffect, useState } from "react";
import { Users, Plus, Percent, Edit2, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Modal } from "@/components/ui/Modal";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { getInitials } from "@/lib/utils";

interface Barber {
  id: string; commission: number; nickname: string | null; active: boolean; dayOff: number | null;
  user: { id: string; name: string; email: string; phone: string | null };
}

type FormMode = "add" | "edit";

const DAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const emptyForm = { name: "", email: "", phone: "", password: "", commission: "50", nickname: "", dayOff: "" };

export default function BarbeirosPage() {
  const { token } = useAuthStore();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FormMode>("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function load() {
    const r = await fetch("/api/barbershop/barbers?includeInactive=true", { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    setBarbers(d.barbers || []);
    setPageLoading(false);
  }

  async function handleToggleActive(b: Barber) {
    const next = !b.active;
    setBarbers(cur => cur.map(x => x.id === b.id ? { ...x, active: next } : x));
    await fetch("/api/barbershop/barbers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ barberId: b.id, active: next }),
    });
  }

  async function handleDelete(b: Barber) {
    if (!confirm(`Excluir ${b.user.name}? O histórico de atendimentos será mantido.`)) return;
    await fetch("/api/barbershop/barbers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ barberId: b.id }),
    });
    load();
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setMode("add");
    setForm(emptyForm);
    setEditingId(null);
    setOpen(true);
  }

  function openEdit(b: Barber) {
    setMode("edit");
    setEditingId(b.id);
    setForm({
      name: b.user.name,
      email: b.user.email,
      phone: b.user.phone ?? "",
      password: "",
      commission: String(b.commission),
      nickname: b.nickname ?? "",
      dayOff: b.dayOff !== null && b.dayOff !== undefined ? String(b.dayOff) : "",
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (mode === "add") {
      await fetch("/api/barbershop/barbers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/barbershop/barbers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ barberId: editingId, ...form }),
      });
    }

    setLoading(false);
    setOpen(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Profissionais</h1>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" /> Novo Profissional
        </Button>
      </div>

      {pageLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} rows={3} />)}
        </div>
      ) : barbers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400 bg-white rounded-xl border border-zinc-100">
          <Users className="w-12 h-12 mb-3" />
          <p className="font-medium">Nenhum profissional cadastrado</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {barbers.map((b) => (
            <div key={b.id} className={`bg-white rounded-xl border shadow-sm p-5 transition-opacity ${b.active ? "border-zinc-100" : "border-zinc-200 opacity-60"}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${b.active ? "bg-primary/20" : "bg-zinc-100"}`}>
                  <span className={`font-bold text-sm ${b.active ? "text-primary" : "text-zinc-400"}`}>{getInitials(b.user.name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-zinc-900">{b.user.name}</p>
                    {!b.active && (
                      <span className="text-[10px] bg-zinc-100 text-zinc-500 border border-zinc-200 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">Em Férias</span>
                    )}
                  </div>
                  {b.nickname && <p className="text-xs text-zinc-400">{b.nickname}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Toggle ativo */}
                  <button
                    onClick={() => handleToggleActive(b)}
                    title={b.active ? "Desativar (colocar em férias)" : "Reativar barbeiro"}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${b.active ? "bg-green-400" : "bg-zinc-300"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${b.active ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                  <button
                    onClick={() => openEdit(b)}
                    className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-zinc-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(b)}
                    className="p-2 rounded-lg border border-red-100 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-zinc-500">📧 {b.user.email}</p>
                {b.user.phone && <p className="text-zinc-500">📱 {b.user.phone}</p>}
                <div className="flex items-center gap-1 mt-2">
                  <Percent className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-primary">{b.commission}% de comissão</span>
                </div>
                {b.dayOff !== null && b.dayOff !== undefined && (
                  <p className="text-xs text-zinc-400 mt-1">🗓 Folga: {DAYS[b.dayOff]}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={mode === "edit" ? "Editar Profissional" : "Novo Profissional"}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input label="Nome completo" value={form.name} onChange={(e) => setField("name", e.target.value)} required />
          <Input label="Apelido (opcional)" value={form.nickname} onChange={(e) => setField("nickname", e.target.value)} />
          {mode === "add" && (
            <Input label="E-mail" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} required />
          )}
          {mode === "edit" && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1">E-mail</label>
              <p className="text-sm text-zinc-400 bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-200">{form.email}</p>
            </div>
          )}
          <Input label="WhatsApp" type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
          <Input
            label={mode === "edit" ? "Nova senha (deixe em branco para manter)" : "Senha de acesso"}
            type="password"
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            placeholder={mode === "edit" ? "••••••••" : "senha123"}
            required={mode === "add"}
          />
          <Input label="Comissão (%)" type="number" min="0" max="100" value={form.commission} onChange={(e) => setField("commission", e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Dia de folga</label>
            <select
              value={form.dayOff}
              onChange={(e) => setField("dayOff", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Sem folga fixa</option>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <Button type="submit" loading={loading} className="w-full mt-2">
            {mode === "edit" ? "Salvar alterações" : "Cadastrar Profissional"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
