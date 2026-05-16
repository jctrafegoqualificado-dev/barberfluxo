"use client";
import { useEffect, useState, useCallback } from "react";
import { Search, Users, CalendarDays, DollarSign, RotateCcw, BadgeCheck, Edit3, Trash2, X, Save, AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, getInitials } from "@/lib/utils";
import { ConfirmDialog, AlertDialog } from "@/components/ui/ConfirmDialog";

interface Cliente {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  totalVisits: number;
  totalSpent: number;
  thisMonthVisits: number;
  firstVisit: string;
  lastVisit: string;
  daysSinceLastVisit: number;
  avgFrequency: number | null;
  isNew: boolean;
  activePlan: string | null;
}

function FrequencyBadge({ days }: { days: number | null }) {
  if (!days) return <span className="text-xs text-zinc-400">—</span>;
  const color = days <= 21 ? "text-green-600 bg-green-50" : days <= 45 ? "text-amber-600 bg-amber-50" : "text-red-500 bg-red-50";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      a cada {days}d
    </span>
  );
}

function LastVisitBadge({ days }: { days: number }) {
  if (days === 0) return <span className="text-xs font-medium text-green-600">Hoje</span>;
  if (days <= 7) return <span className="text-xs font-medium text-green-600">{days}d atrás</span>;
  if (days <= 30) return <span className="text-xs font-medium text-amber-600">{days}d atrás</span>;
  return <span className="text-xs font-medium text-red-500">{days}d atrás</span>;
}

export default function ClientesPage() {
  const { token } = useAuthStore();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "novos" | "recorrentes" | "inativos">("todos");
  const [editModal, setEditModal] = useState<Cliente | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ id: string } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ title: string; message: string; type?: "info" | "danger" | "success" } | null>(null);

  const load = useCallback(() => {
    fetch("/api/barbershop/clientes", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setClientes(d.clientes || []); setLoading(false); });
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function openEdit(c: Cliente) {
    setEditModal(c);
    setEditName(c.name);
    setEditPhone(c.phone || "");
  }

  async function handleSaveEdit() {
    if (!editModal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/barbershop/clientes/${editModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName, phone: editPhone }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Erro ao salvar"); return; }
      setEditModal(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id: string) {
    const res = await fetch(`/api/barbershop/clientes/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setAlertDialog({ title: "Erro ao excluir", message: data.error || "Tente novamente mais tarde.", type: "danger" });
      return;
    }
    setEditModal(null);
    setAlertDialog({ title: "Cliente excluído", message: "O cadastro foi anonimizado e removido da lista ativa.", type: "success" });
    load();
  }

  function handleDelete(id: string) {
    setConfirmDialog({ id });
  }

  const filtered = clientes.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search);
    const matchFilter =
      filter === "todos" ? true :
      filter === "novos" ? c.isNew :
      filter === "recorrentes" ? !c.isNew && c.totalVisits > 1 :
      filter === "inativos" ? c.daysSinceLastVisit > 60 : true;
    return matchSearch && matchFilter;
  });

  const totalNovos = clientes.filter((c) => c.isNew).length;
  const totalInativos = clientes.filter((c) => c.daysSinceLastVisit > 60).length;
  const totalRecorrentes = clientes.filter((c) => !c.isNew && c.totalVisits > 1).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Clientes</h1>
          <p className="text-zinc-500 text-sm mt-1">Histórico e perfil de cada cliente da barbearia</p>
        </div>
        {!loading && (
          <div className="text-right">
            <p className="text-2xl font-black text-zinc-900">{clientes.length}</p>
            <p className="text-xs text-zinc-400">clientes únicos</p>
          </div>
        )}
      </div>

      {/* Filtros rápidos */}
      {!loading && (
        <div className="flex gap-2 flex-wrap">
          {([
            { key: "todos", label: `Todos (${clientes.length})` },
            { key: "novos", label: `Novos este mês (${totalNovos})` },
            { key: "recorrentes", label: `Recorrentes (${totalRecorrentes})` },
            { key: "inativos", label: `Inativos +60d (${totalInativos})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === key ? "bg-amber-500 text-white" : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, email ou telefone..."
          className="w-full rounded-xl border border-zinc-200 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-100 p-16 text-center text-zinc-400">
          <Users className="w-10 h-10 mx-auto mb-3" />
          <p className="font-medium">Nenhum cliente encontrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-zinc-50">
            {filtered.map((c) => (
              <div key={c.id} className="px-5 py-4 flex items-center gap-4 group">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <span className="text-amber-700 font-bold text-sm">{getInitials(c.name)}</span>
                </div>

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-zinc-900 truncate">{c.name}</p>
                    {c.isNew && (
                      <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">Novo</span>
                    )}
                    {c.activePlan && (
                      <span className="shrink-0 flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">
                        <BadgeCheck className="w-3 h-3" />{c.activePlan}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                </div>

                {/* Métricas */}
                <div className="hidden sm:flex items-center gap-6 shrink-0">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-zinc-500 mb-0.5">
                      <CalendarDays className="w-3 h-3" />
                      <span className="text-xs">Visitas</span>
                    </div>
                    <p className="text-sm font-bold text-zinc-900">{c.totalVisits}</p>
                    {c.thisMonthVisits > 0 && (
                      <p className="text-xs text-amber-600">+{c.thisMonthVisits} esse mês</p>
                    )}
                  </div>

                  <div className="text-center">
                    <div className="flex items-center gap-1 text-zinc-500 mb-0.5">
                      <DollarSign className="w-3 h-3" />
                      <span className="text-xs">Gasto total</span>
                    </div>
                    <p className="text-sm font-bold text-zinc-900">{formatCurrency(c.totalSpent)}</p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center gap-1 text-zinc-500 mb-0.5">
                      <RotateCcw className="w-3 h-3" />
                      <span className="text-xs">Frequência</span>
                    </div>
                    <FrequencyBadge days={c.avgFrequency} />
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-zinc-400 mb-0.5">Última visita</p>
                    <LastVisitBadge days={c.daysSinceLastVisit} />
                  </div>
                </div>

                {/* Botão Editar */}
                <button
                  onClick={() => openEdit(c)}
                  className="shrink-0 p-2 rounded-lg border border-zinc-200 text-zinc-400 hover:text-amber-500 hover:border-amber-200 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h2 className="font-semibold text-zinc-900">Editar Cliente</h2>
              <button onClick={() => setEditModal(null)} className="p-1 rounded-lg hover:bg-zinc-100">
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Nome</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">WhatsApp</label>
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
              </div>
              {editModal.activePlan && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-sm">
                  <p className="text-green-700 font-medium flex items-center gap-1">
                    <BadgeCheck className="w-4 h-4" /> Plano Ativo: {editModal.activePlan}
                  </p>
                </div>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => handleDelete(editModal.id)}
                className="p-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => setEditModal(null)}
                className="flex-1 py-3 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50">
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editName.trim()}
                className="flex-[1.5] py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
              >
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDialog}
        title="Excluir Cliente?"
        message="O cadastro será anonimizado. Agendamentos e assinaturas ativos serão cancelados, mas o histórico financeiro será preservado."
        onConfirm={() => {
          if (confirmDialog) confirmDelete(confirmDialog.id);
          setConfirmDialog(null);
        }}
        onCancel={() => setConfirmDialog(null)}
      />

      <AlertDialog
        isOpen={!!alertDialog}
        title={alertDialog?.title || ""}
        message={alertDialog?.message || ""}
        type={alertDialog?.type}
        onClose={() => setAlertDialog(null)}
      />
    </div>
  );
}

