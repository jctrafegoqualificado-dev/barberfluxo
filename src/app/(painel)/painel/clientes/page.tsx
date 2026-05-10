"use client";
import { useEffect, useState } from "react";
import { Search, Users, CalendarDays, DollarSign, RotateCcw, BadgeCheck } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, getInitials } from "@/lib/utils";

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

  useEffect(() => {
    fetch("/api/barbershop/clientes", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setClientes(d.clientes || []); setLoading(false); });
  }, [token]);

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
              <div key={c.id} className="px-5 py-4 flex items-center gap-4">
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
