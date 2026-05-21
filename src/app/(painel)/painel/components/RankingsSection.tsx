"use client";
import React from "react";
import { Crown, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface RankingsSectionProps {
  topBarbers: Array<{
    id: string;
    name: string;
    revenue: number;
    appointments: number;
  }>;
  topClients: Array<{
    id: string;
    name: string;
    totalSpent: number;
    visits: number;
  }>;
  periodLabel: string;
}

export function RankingsSection({
  topBarbers,
  topClients,
  periodLabel,
}: RankingsSectionProps) {
  const maxBarberRevenue = topBarbers?.[0]?.revenue || 1;
  const maxClientSpent = topClients?.[0]?.totalSpent || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Profissionais */}
      <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-zinc-900 text-sm">Top Profissionais</h3>
          </div>
          <span className="text-[10px] text-zinc-400 font-medium uppercase">
            {periodLabel}
          </span>
        </div>
        {topBarbers.length === 0 ? (
          <div className="py-10 text-center text-zinc-400 text-sm">
            Sem dados no período
          </div>
        ) : (
          <div className="divide-y divide-zinc-50 max-h-96 overflow-y-auto">
            {topBarbers.map((b, i) => (
              <div
                key={b.id}
                className="px-5 py-3.5 flex items-center gap-4 hover:bg-zinc-50/50 transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    i === 0
                      ? "bg-amber-100 text-amber-700"
                      : i === 1
                      ? "bg-zinc-200 text-zinc-600"
                      : i === 2
                      ? "bg-orange-100 text-orange-600"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {i + 1}º
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{b.name}</p>
                  <p className="text-[10px] text-zinc-400">
                    {b.appointments} atendimentos
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-zinc-900">
                    {formatCurrency(b.revenue)}
                  </p>
                  <div className="w-24 h-1.5 rounded-full bg-zinc-100 mt-1 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: `${Math.round((b.revenue / maxBarberRevenue) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Clientes */}
      <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <h3 className="font-bold text-zinc-900 text-sm">Top Clientes</h3>
          </div>
          <span className="text-[10px] text-zinc-400 font-medium uppercase">
            {periodLabel}
          </span>
        </div>
        {topClients.length === 0 ? (
          <div className="py-10 text-center text-zinc-400 text-sm">
            Sem dados no período
          </div>
        ) : (
          <div className="divide-y divide-zinc-50 max-h-96 overflow-y-auto">
            {topClients.map((c, i) => (
              <div
                key={c.id}
                className="px-5 py-3.5 flex items-center gap-4 hover:bg-zinc-50/50 transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                    i === 0 ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {c.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{c.name}</p>
                  <p className="text-[10px] text-zinc-400">{c.visits} visitas</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-zinc-900">
                    {formatCurrency(c.totalSpent)}
                  </p>
                  <div className="w-24 h-1.5 rounded-full bg-zinc-100 mt-1 overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all"
                      style={{
                        width: `${Math.round(
                          (c.totalSpent / maxClientSpent) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
