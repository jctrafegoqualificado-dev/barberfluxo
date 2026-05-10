"use client";
import { useEffect, useState } from "react";
import { TrendingUp, Scissors, CreditCard, Package, ChevronLeft, ChevronRight, CheckCircle, UserX } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";

interface ServiceRanking {
  name: string; count: number; faturado: number;
}
interface DiaProd {
  data: string; label: string; diaSemana: string; atendimentos: number; faturado: number;
}
interface Kpis {
  atendimentos: number; totalAgendados: number; noShow: number; cancelled: number;
  taxaComparecimento: number | null; faturado: number;
  comissaoServicos: number; comissaoProdutos: number; totalComissao: number;
  avulso: number; assinatura: number; produtos: number; faturadoProdutos: number;
}
interface ProducaoData {
  mes: string; monthOffset: number;
  barber: { commissionType: string; commission: number; productCommissionType: string; productCommission: number };
  kpis: Kpis;
  servicosRanking: ServiceRanking[];
  producaoDiaria: DiaProd[];
}

export default function ProducaoPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<ProducaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(0);

  async function load(m: number) {
    setLoading(true);
    const r = await fetch(`/api/barber/producao?month=${m}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setData(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(month); }, [month]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!data) return null;

  const { kpis, servicosRanking, producaoDiaria, mes } = data;
  const maxFaturado = Math.max(...producaoDiaria.map((d) => d.faturado), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Minha Produção</h1>
          <p className="text-zinc-500 text-sm mt-0.5 capitalize">{mes}</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2">
          <button onClick={() => setMonth((m) => m + 1)} className="p-1 rounded hover:bg-zinc-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-zinc-500" />
          </button>
          <span className="text-sm font-medium text-zinc-700 min-w-[110px] text-center capitalize">{mes}</span>
          <button onClick={() => { if (month > 0) setMonth((m) => m - 1); }}
            disabled={month === 0}
            className="p-1 rounded hover:bg-zinc-100 transition-colors disabled:opacity-30">
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-amber-500 rounded-xl p-4 text-white col-span-2 sm:col-span-1">
          <p className="text-xs opacity-80 font-medium mb-1">Comissão total</p>
          <p className="text-2xl font-black">{formatCurrency(kpis.totalComissao)}</p>
          <p className="text-xs opacity-70 mt-0.5">serv. + produtos</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-100 p-4">
          <div className="flex items-center gap-1 mb-1 text-zinc-400">
            <Scissors className="w-3.5 h-3.5" />
            <span className="text-xs">Atendimentos</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900">{kpis.atendimentos}</p>
          <p className="text-xs text-zinc-400">{kpis.avulso} avulsos · {kpis.assinatura} assinat.</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-100 p-4">
          <div className="flex items-center gap-1 mb-1 text-zinc-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs">Faturado</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900">{formatCurrency(kpis.faturado)}</p>
          <p className="text-xs text-zinc-400">serviços</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-100 p-4">
          <div className="flex items-center gap-1 mb-1 text-zinc-400">
            <Package className="w-3.5 h-3.5" />
            <span className="text-xs">Produtos</span>
          </div>
          <p className="text-2xl font-bold text-zinc-900">{kpis.produtos}</p>
          <p className="text-xs text-zinc-400">{formatCurrency(kpis.faturadoProdutos)} vendidos</p>
        </div>
      </div>

      {/* Taxa de comparecimento */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-zinc-100 p-4 text-center">
          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-zinc-900">{kpis.atendimentos}</p>
          <p className="text-xs text-zinc-400">realizados</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-100 p-4 text-center">
          <UserX className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-zinc-900">{kpis.noShow}</p>
          <p className="text-xs text-zinc-400">não compareceram</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${
          kpis.taxaComparecimento === null ? "bg-zinc-50 border-zinc-100" :
          kpis.taxaComparecimento >= 80 ? "bg-green-50 border-green-100" :
          kpis.taxaComparecimento >= 60 ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100"
        }`}>
          <p className={`text-xl font-bold ${
            kpis.taxaComparecimento === null ? "text-zinc-400" :
            kpis.taxaComparecimento >= 80 ? "text-green-700" :
            kpis.taxaComparecimento >= 60 ? "text-amber-700" : "text-red-600"
          }`}>
            {kpis.taxaComparecimento !== null ? `${kpis.taxaComparecimento}%` : "—"}
          </p>
          <p className="text-xs text-zinc-400">comparecimento</p>
        </div>
      </div>

      {/* Comissões detalhadas */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-5">
        <h2 className="font-semibold text-zinc-900 mb-4">Detalhamento de Comissões</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-zinc-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <Scissors className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">Serviços</p>
                <p className="text-xs text-zinc-400">{kpis.atendimentos} atendimentos · {formatCurrency(kpis.faturado)} faturado</p>
              </div>
            </div>
            <p className="text-lg font-bold text-amber-600">{formatCurrency(kpis.comissaoServicos)}</p>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-zinc-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Package className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">Produtos</p>
                <p className="text-xs text-zinc-400">{kpis.produtos} vendas · {formatCurrency(kpis.faturadoProdutos)} faturado</p>
              </div>
            </div>
            <p className="text-lg font-bold text-amber-600">{formatCurrency(kpis.comissaoProdutos)}</p>
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="font-bold text-zinc-900">Total a receber</p>
            <p className="text-xl font-black text-amber-600">{formatCurrency(kpis.totalComissao)}</p>
          </div>
        </div>
      </div>

      {/* Gráfico produção diária */}
      {producaoDiaria.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-5">
          <h2 className="font-semibold text-zinc-900 mb-4">Produção por Dia</h2>
          <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: 100 }}>
            {producaoDiaria.map((d) => {
              const height = Math.round((d.faturado / maxFaturado) * 80);
              return (
                <div key={d.data} className="flex flex-col items-center gap-1 min-w-[36px]">
                  <span className="text-xs text-zinc-400 whitespace-nowrap">{formatCurrency(d.faturado).replace("R$\u00a0", "")}</span>
                  <div className="w-full flex items-end justify-center" style={{ height: 80 }}>
                    <div
                      className="w-full rounded-t-md bg-amber-400 hover:bg-amber-500 transition-colors cursor-default"
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${d.atendimentos} atend.`}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 font-semibold">{d.label}</span>
                  <span className="text-xs text-zinc-400">{d.diaSemana}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ranking de serviços */}
      {servicosRanking.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-5">
          <h2 className="font-semibold text-zinc-900 mb-4">Serviços Mais Realizados</h2>
          <div className="space-y-3">
            {servicosRanking.map((s, i) => {
              const pct = Math.round((s.count / kpis.atendimentos) * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-zinc-400 w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-zinc-800">{s.name}</span>
                      <span className="text-xs text-zinc-400">{s.count}x · {formatCurrency(s.faturado)}</span>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-zinc-500 w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
