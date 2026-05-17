"use client";
import { useEffect, useState } from "react";
import { Search, Users, CalendarDays, RotateCcw } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getInitials } from "@/lib/utils";

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

function LastVisitBadge({ days }: { days: number }) {
  if (days === 0) return <span className="text-xs font-medium text-green-600">Hoje</span>;
  if (days <= 7) return <span className="text-xs font-medium text-green-600">{days}d atrás</span>;
  if (days <= 30) return <span className="text-xs font-medium text-primary/90">{days}d atrás</span>;
  return <span className="text-xs font-medium text-red-500">{days}d atrás</span>;
}

export default function BarbeiroClientesPage() {
  const { token } = useAuthStore();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/barbershop/clientes", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setClientes(d.clientes || []); setLoading(false); });
  }, [token]);

  const filtered = clientes.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? "").includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Meus Clientes</h1>
          <p className="text-zinc-500 text-sm mt-1">Clientes que você já atendeu</p>
        </div>
        {!loading && (
          <div className="text-right">
            <p className="text-2xl font-black text-zinc-900">{clientes.length}</p>
            <p className="text-xs text-zinc-400">clientes únicos</p>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="w-full rounded-xl border border-zinc-200 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
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
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-amber-700 font-bold text-sm">{getInitials(c.name)}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-zinc-900 truncate">{c.name}</p>
                    {c.isNew && (
                      <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">Novo</span>
                    )}
                  </div>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="text-xs text-primary/90 hover:underline">{c.phone}</a>
                  )}
                </div>

                <div className="flex items-center gap-5 shrink-0 text-right">
                  <div className="hidden sm:block text-center">
                    <div className="flex items-center gap-1 text-zinc-400 mb-0.5 justify-center">
                      <CalendarDays className="w-3 h-3" />
                      <span className="text-xs">Visitas</span>
                    </div>
                    <p className="text-sm font-bold text-zinc-900">{c.totalVisits}</p>
                    {c.thisMonthVisits > 0 && (
                      <p className="text-xs text-primary/90">+{c.thisMonthVisits} esse mês</p>
                    )}
                  </div>

                  {c.avgFrequency && (
                    <div className="hidden sm:block text-center">
                      <div className="flex items-center gap-1 text-zinc-400 mb-0.5 justify-center">
                        <RotateCcw className="w-3 h-3" />
                        <span className="text-xs">Freq.</span>
                      </div>
                      <span className="text-xs font-medium text-zinc-600">a cada {c.avgFrequency}d</span>
                    </div>
                  )}

                  <div>
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
