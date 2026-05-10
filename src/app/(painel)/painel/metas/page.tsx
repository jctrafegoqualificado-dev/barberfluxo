"use client";
import { useEffect, useState } from "react";
import {
  Target, Plus, Trash2, Users, DollarSign,
  CreditCard, Clock, CheckCircle, TrendingUp
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";

interface Meta {
  id: string; titulo: string; tipo: string; periodo: string;
  valorAlvo: number; atual: number; pct: number;
  barber: { user: { name: string } } | null;
}
interface Barber { id: string; user: { name: string } }

const TIPOS = [
  { value: "ATENDIMENTOS", label: "Atendimentos", icon: Users, color: "blue", unit: "atend." },
  { value: "RECEITA", label: "Receita", icon: DollarSign, color: "green", unit: "R$" },
  { value: "ASSINANTES", label: "Assinantes", icon: CreditCard, color: "purple", unit: "assín." },
  { value: "OCUPACAO", label: "Taxa de Ocupação", icon: Clock, color: "amber", unit: "%" },
];

const TIPO_MAP = Object.fromEntries(TIPOS.map((t) => [t.value, t]));

function formatValor(tipo: string, valor: number) {
  if (tipo === "RECEITA") return formatCurrency(valor);
  if (tipo === "OCUPACAO") return `${valor}%`;
  return String(Math.round(valor));
}

function MetaCard({ meta, onDelete }: { meta: Meta; onDelete: () => void }) {
  const config = TIPO_MAP[meta.tipo];
  const Icon = config?.icon || Target;

  const colorMap: Record<string, { bg: string; bar: string; text: string; badge: string }> = {
    blue:   { bg: "bg-blue-50",   bar: "bg-blue-400",   text: "text-blue-700",   badge: "bg-blue-100 text-blue-700" },
    green:  { bg: "bg-green-50",  bar: "bg-green-400",  text: "text-green-700",  badge: "bg-green-100 text-green-700" },
    purple: { bg: "bg-purple-50", bar: "bg-purple-400", text: "text-purple-700", badge: "bg-purple-100 text-purple-700" },
    amber:  { bg: "bg-amber-50",  bar: "bg-amber-400",  text: "text-amber-700",  badge: "bg-amber-100 text-amber-700" },
  };
  const c = colorMap[config?.color || "blue"];

  const status = meta.pct >= 100 ? "concluída" : meta.pct >= 70 ? "no caminho" : meta.pct >= 40 ? "atenção" : "crítico";
  const statusColor = meta.pct >= 100 ? "text-green-600" : meta.pct >= 70 ? "text-amber-600" : "text-red-500";

  return (
    <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
          <div>
            <p className="font-semibold text-zinc-900">{meta.titulo}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>
                {config?.label}
              </span>
              <span className="text-xs text-zinc-400">
                {meta.periodo === "MONTHLY" ? "Mensal" : "Semanal"}
              </span>
              {meta.barber && (
                <span className="text-xs text-zinc-400">· {meta.barber.user.name}</span>
              )}
            </div>
          </div>
        </div>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-300 hover:text-red-500 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Progresso */}
      <div className="mb-3">
        <div className="flex justify-between items-end mb-1.5">
          <div>
            <span className={`text-3xl font-black ${c.text}`}>{formatValor(meta.tipo, meta.atual)}</span>
            <span className="text-sm text-zinc-400 ml-1">/ {formatValor(meta.tipo, meta.valorAlvo)}</span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-zinc-900">{meta.pct}%</span>
          </div>
        </div>
        <div className="w-full bg-zinc-100 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-700 ${meta.pct >= 100 ? "bg-green-400" : c.bar}`}
            style={{ width: `${meta.pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {meta.pct >= 100 && <CheckCircle className="w-4 h-4 text-green-500" />}
          <span className={`text-xs font-medium ${statusColor}`}>
            {meta.pct >= 100 ? "Meta atingida! 🎉" : `${status} — faltam ${formatValor(meta.tipo, Math.max(0, meta.valorAlvo - meta.atual))}`}
          </span>
        </div>
        <TrendingUp className={`w-4 h-4 ${meta.pct >= 50 ? "text-green-400" : "text-red-400"}`} />
      </div>
    </div>
  );
}

export default function MetasPage() {
  const { token } = useAuthStore();
  const [metas, setMetas] = useState<Meta[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    titulo: "", tipo: "ATENDIMENTOS", periodo: "MONTHLY", valorAlvo: "", barberId: "",
  });

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function load() {
    const [mr, br] = await Promise.all([
      fetch("/api/barbershop/metas", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/barbershop/barbers", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [md, bd] = await Promise.all([mr.json(), br.json()]);
    setMetas(md.metas || []);
    setBarbers(bd.barbers || []);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/barbershop/metas", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    setLoading(false);
    setOpen(false);
    setForm({ titulo: "", tipo: "ATENDIMENTOS", periodo: "MONTHLY", valorAlvo: "", barberId: "" });
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/barbershop/metas/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  const metasBarbearia = metas.filter((m) => !m.barber);
  const metasBarbeiros = metas.filter((m) => m.barber);
  const concluidas = metas.filter((m) => m.pct >= 100).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Metas</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {metas.length} meta{metas.length !== 1 ? "s" : ""} ativas
            {concluidas > 0 && ` · ${concluidas} concluída${concluidas !== 1 ? "s" : ""} 🎉`}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nova Meta
        </Button>
      </div>

      {metas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-zinc-100 text-zinc-400">
          <Target className="w-14 h-14 mb-3" />
          <p className="font-semibold text-lg">Nenhuma meta cadastrada</p>
          <p className="text-sm mt-1">Defina metas para acompanhar o crescimento da barbearia</p>
          <Button className="mt-5" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Criar primeira meta
          </Button>
        </div>
      ) : (
        <>
          {metasBarbearia.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                🏠 Barbearia
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {metasBarbearia.map((m) => (
                  <MetaCard key={m.id} meta={m} onDelete={() => handleDelete(m.id)} />
                ))}
              </div>
            </div>
          )}

          {metasBarbeiros.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                💈 Por Barbeiro
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {metasBarbeiros.map((m) => (
                  <MetaCard key={m.id} meta={m} onDelete={() => handleDelete(m.id)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nova Meta" className="max-w-lg">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="Título da meta"
            value={form.titulo}
            onChange={(e) => setField("titulo", e.target.value)}
            placeholder="Ex: 100 atendimentos em abril"
            required
          />

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Tipo de meta</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((t) => {
                const Icon = t.icon;
                const selected = form.tipo === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setField("tipo", t.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                      selected ? "border-amber-500 bg-amber-50 text-amber-700" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Período</label>
              <select
                value={form.periodo}
                onChange={(e) => setField("periodo", e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="MONTHLY">Mensal</option>
                <option value="WEEKLY">Semanal</option>
              </select>
            </div>
            <Input
              label={`Meta (${TIPO_MAP[form.tipo]?.unit || ""})`}
              type="number"
              min="1"
              step={form.tipo === "RECEITA" ? "0.01" : "1"}
              value={form.valorAlvo}
              onChange={(e) => setField("valorAlvo", e.target.value)}
              placeholder={form.tipo === "RECEITA" ? "5000" : form.tipo === "OCUPACAO" ? "70" : "100"}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Atribuir a (opcional)
            </label>
            <select
              value={form.barberId}
              onChange={(e) => setField("barberId", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">🏠 Barbearia toda</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>💈 {b.user.name}</option>
              ))}
            </select>
          </div>

          <Button type="submit" loading={loading} className="w-full mt-2">
            Criar Meta
          </Button>
        </form>
      </Modal>
    </div>
  );
}
