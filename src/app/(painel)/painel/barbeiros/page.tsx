"use client";
import { useEffect, useState } from "react";
import { Users, Plus, Percent, Edit2, Trash2, Camera } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Modal } from "@/components/ui/Modal";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { getInitials } from "@/lib/utils";

interface Barber {
  id: string;
  commission: number;
  nickname: string | null;
  active: boolean;
  dayOff: number | null;
  photoUrl: string | null;
  cpf: string | null;
  user: { id: string; name: string; email: string; phone: string | null; birthday: string | null };
}

type FormMode = "add" | "edit";

const DAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const emptyForm = {
  name: "", email: "", phone: "", password: "", commission: "50",
  nickname: "", dayOff: "", photoUrl: "", cpf: "", birthday: "",
};

function maskCpf(v: string) {
  return v.replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
    .slice(0, 14);
}

function resizeImageToBase64(file: File, maxPx = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
    const r = await fetch("/api/barbershop/barbers?includeInactive=true", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    setBarbers(d.barbers || []);
    setPageLoading(false);
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await resizeImageToBase64(file, 400);
    setField("photoUrl", base64);
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
      photoUrl: b.photoUrl ?? "",
      cpf: b.cpf ?? "",
      birthday: b.user.birthday ? b.user.birthday.split("T")[0] : "",
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
            <div
              key={b.id}
              className={`bg-white rounded-xl border shadow-sm p-5 transition-opacity ${b.active ? "border-zinc-100" : "border-zinc-200 opacity-60"}`}
            >
              <div className="flex items-center gap-3 mb-4">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center ${!b.photoUrl ? (b.active ? "bg-primary/20" : "bg-zinc-100") : ""}`}>
                  {b.photoUrl ? (
                    <img src={b.photoUrl} alt={b.user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className={`font-bold text-sm ${b.active ? "text-primary" : "text-zinc-400"}`}>
                      {getInitials(b.user.name)}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-zinc-900">{b.user.name}</p>
                    {!b.active && (
                      <span className="text-[10px] bg-zinc-100 text-zinc-500 border border-zinc-200 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                        Em Férias
                      </span>
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
                {b.cpf && <p className="text-zinc-400 text-xs">🪪 CPF: {b.cpf}</p>}
                {b.user.birthday && (
                  <p className="text-zinc-400 text-xs">
                    🎂 {new Date(b.user.birthday).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </p>
                )}
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "edit" ? "Editar Profissional" : "Novo Profissional"}
      >
        <form onSubmit={handleSubmit} className="space-y-3">

          {/* Foto do profissional */}
          <div className="flex justify-center mb-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-100 border-2 border-zinc-200 flex items-center justify-center">
                {form.photoUrl ? (
                  <img src={form.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-zinc-400 text-2xl font-bold">
                    {getInitials(form.name || "?")}
                  </span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-primary/90 transition-colors">
                <Camera className="w-3.5 h-3.5 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
            </div>
          </div>

          <Input
            label="Nome completo"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            required
          />
          <Input
            label="Apelido (opcional)"
            value={form.nickname}
            onChange={(e) => setField("nickname", e.target.value)}
          />

          {mode === "add" && (
            <Input
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              required
            />
          )}
          {mode === "edit" && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1">E-mail</label>
              <p className="text-sm text-zinc-400 bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-200">{form.email}</p>
            </div>
          )}

          <Input
            label="WhatsApp"
            type="tel"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
          />

          {/* CPF */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">CPF <span className="text-zinc-400 font-normal">(opcional)</span></label>
            <input
              value={form.cpf}
              onChange={(e) => setField("cpf", maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Data de Nascimento */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Data de Nascimento <span className="text-zinc-400 font-normal">(opcional)</span></label>
            <input
              type="date"
              value={form.birthday}
              onChange={(e) => setField("birthday", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <Input
            label={mode === "edit" ? "Nova senha (deixe em branco para manter)" : "Senha de acesso"}
            type="password"
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            placeholder={mode === "edit" ? "••••••••" : "senha123"}
            required={mode === "add"}
          />
          <Input
            label="Comissão (%)"
            type="number"
            min="0"
            max="100"
            value={form.commission}
            onChange={(e) => setField("commission", e.target.value)}
          />

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
