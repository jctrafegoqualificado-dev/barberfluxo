"use client";
import { useEffect, useState } from "react";
import { Clock, TrendingUp, Users, Calendar, Star, AlertCircle, RefreshCw, Timer } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getInitials } from "@/lib/utils";

interface BarberRetencao {
  id: string; name: string;
  clientesMesPassado: number;
  clientesRetornaram: number;
  taxaRetorno: number | null;
  mediaFrequencia: number | null;
  totalClientesUnicos: number;
}

interface BarberStat {
  id: string; name: string; atendimentos: number;
  minOcupados: number; minDisponiveis: number; taxa: number;
}
interface DiaData {
  data: string; label: string; taxa: number; atendimentos: number;
}
interface OcupacaoData {
  periodo: string;
  taxaGeral: number;
  totalOcupadoGeral: number;
  totalDisponivelGeral: number;
  totalAtendimentos: number;
  diasUteis: number;
  porBarbeiro: BarberStat[];
  porDia: DiaData[];
  melhorDia: DiaData | null;
  piorDia: DiaData | null;
}

function OcupacaoGauge({ taxa }: { taxa: number }) {
  const color = taxa >= 70 ? "text-green-600" : taxa >= 40 ? "text-amber-500" : "text-red-500";
  const ring = taxa >= 70 ? "stroke-green-500" : taxa >= 40 ? "stroke-amber-400" : "stroke-red-400";
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (taxa / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#f4f4f5" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={r} fill="none" strokeWidth="10"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${ring} transition-all duration-700`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-black ${color}`}>{taxa}%</span>
          <span className="text-xs text-zinc-400 mt-0.5">ocupação</span>
        </div>
      </div>
    </div>
  );
}

function BarberOcupacaoCard({ b, rank }: { b: BarberStat; rank: number }) {
  const color = b.taxa >= 70 ? "bg-green-400" : b.taxa >= 40 ? "bg-amber-400" : "bg-red-400";
  const textColor = b.taxa >= 70 ? "text-green-600" : b.taxa >= 40 ? "text-amber-600" : "text-red-500";
  const horas = Math.floor(b.minOcupados / 60);
  const min = b.minOcupados % 60;

  return (
    <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <span className="text-amber-700 font-bold text-sm">{getInitials(b.name)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-900 truncate">{b.name}</p>
          <p className="text-xs text-zinc-400">{b.atendimentos} atendimentos</p>
        </div>
        <span className={`text-2xl font-black ${textColor}`}>{b.taxa}%</span>
      </div>

      {/* Barra de ocupação */}
      <div className="w-full bg-zinc-100 rounded-full h-3 mb-3">
        <div
          className={`h-3 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${b.taxa}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-zinc-400">
        <span>⏱ {horas}h{min > 0 ? `${min}min` : ""} ocupado</span>
        <span>{Math.floor(b.minDisponiveis / 60)}h disponível</span>
      </div>
    </div>
  );
}

function DiaBar({ dia, maxTaxa }: { dia: DiaData; maxTaxa: number }) {
  const height = maxTaxa > 0 ? Math.round((dia.taxa / maxTaxa) * 100) : 0;
  const color = dia.taxa >= 70 ? "bg-green-400" : dia.taxa >= 40 ? "bg-amber-400" : dia.taxa > 0 ? "bg-red-300" : "bg-zinc-100";

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <span className="text-xs font-medium text-zinc-600">{dia.taxa > 0 ? `${dia.taxa}%` : ""}</span>
      <div className="w-full flex items-end justify-center" style={{ height: 80 }}>
        <div
          className={`w-full rounded-t-md transition-all duration-500 ${color}`}
          style={{ height: `${Math.max(height, dia.taxa > 0 ? 4 : 0)}%` }}
        />
      </div>
      <span className="text-xs text-zinc-400 text-center leading-tight">{dia.label}</span>
      {dia.atendimentos > 0 && (
        <span className="text-xs font-medium text-zinc-600">{dia.atendimentos}</span>
      )}
    </div>
  );
}

export default function OcupacaoPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<OcupacaoData | null>(null);
  const [retencao, setRetencao] = useState<{ porBarbeiro: BarberRetencao[]; taxaGeralRetorno: number; totalLastMonth: number; totalRetornaram: number } | null>(null);
  const [periodo, setPeriodo] = useState<"semana" | "mes">("mes");
  const [loading, setLoading] = useState(true);

  async function load(p: "semana" | "mes") {
    setLoading(true);
    const [ocupacaoRes, retencaoRes] = await Promise.all([
      fetch(`/api/barbershop/ocupacao?periodo=${p}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/barbershop/retencao", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [d, r] = await Promise.all([ocupacaoRes.json(), retencaoRes.json()]);
    setData(d);
    setRetencao(r);
    setLoading(false);
  }

  useEffect(() => { load(periodo); }, [periodo]);

  function minToHoras(min: number) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }

  const maxTaxa = data ? Math.max(...data.porDia.map((d) => d.taxa), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Taxa de Ocupação</h1>
          <p className="text-zinc-500 text-sm mt-1">Baseado em comandas fechadas — tempo real trabalhado por cada barbeiro</p>
        </div>
        <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
          {(["semana", "mes"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${periodo === p ? "bg-amber-500 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
            >
              {p === "semana" ? "Esta semana" : "Este mês"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : data ? (
        <>
          {/* Gauge geral + KPIs */}
          <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <OcupacaoGauge taxa={data.taxaGeral} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 w-full">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-xl font-bold text-zinc-900">{minToHoras(data.totalOcupadoGeral)}</p>
                  <p className="text-xs text-zinc-400">Tempo ocupado</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-lg bg-zinc-50 flex items-center justify-center mx-auto mb-2">
                    <TrendingUp className="w-5 h-5 text-zinc-400" />
                  </div>
                  <p className="text-xl font-bold text-zinc-900">{minToHoras(data.totalDisponivelGeral)}</p>
                  <p className="text-xs text-zinc-400">Disponível total</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mx-auto mb-2">
                    <Users className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="text-xl font-bold text-zinc-900">{data.totalAtendimentos}</p>
                  <p className="text-xs text-zinc-400">Atendimentos</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mx-auto mb-2">
                    <Calendar className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-xl font-bold text-zinc-900">{data.diasUteis}</p>
                  <p className="text-xs text-zinc-400">Dias úteis</p>
                </div>
              </div>
            </div>
          </div>

          {/* Melhor e pior dia */}
          {(data.melhorDia || data.piorDia) && (
            <div className="grid grid-cols-2 gap-4">
              {data.melhorDia && (
                <div className="bg-green-50 rounded-xl border border-green-100 p-4 flex items-center gap-3">
                  <Star className="w-8 h-8 text-green-500 shrink-0" />
                  <div>
                    <p className="text-xs text-green-600 font-medium">Melhor dia</p>
                    <p className="font-bold text-green-800 capitalize">{data.melhorDia.label}</p>
                    <p className="text-sm text-green-700">{data.melhorDia.taxa}% de ocupação · {data.melhorDia.atendimentos} atend.</p>
                  </div>
                </div>
              )}
              {data.piorDia && data.piorDia.data !== data.melhorDia?.data && (
                <div className="bg-red-50 rounded-xl border border-red-100 p-4 flex items-center gap-3">
                  <AlertCircle className="w-8 h-8 text-red-400 shrink-0" />
                  <div>
                    <p className="text-xs text-red-500 font-medium">Dia com menor ocupação</p>
                    <p className="font-bold text-red-700 capitalize">{data.piorDia.label}</p>
                    <p className="text-sm text-red-600">{data.piorDia.taxa}% de ocupação · {data.piorDia.atendimentos} atend.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Gráfico de barras por dia */}
          <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-6">
            <h2 className="font-semibold text-zinc-900 mb-1">Ocupação por Dia</h2>
            <p className="text-xs text-zinc-400 mb-5">% do tempo disponível utilizado · número abaixo = atendimentos</p>
            <div className="flex items-end gap-1">
              {data.porDia.map((dia) => (
                <DiaBar key={dia.data} dia={dia} maxTaxa={maxTaxa} />
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" />≥70% ótimo</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />40–69% regular</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-300 inline-block" />&lt;40% baixo</span>
            </div>
          </div>

          {/* Por barbeiro */}
          <div>
            <h2 className="font-semibold text-zinc-900 mb-3">Ocupação por Barbeiro</h2>
            {data.porBarbeiro.length === 0 ? (
              <div className="bg-white rounded-xl border border-zinc-100 p-10 text-center text-zinc-400">
                Nenhum barbeiro cadastrado
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.porBarbeiro.map((b, i) => (
                  <BarberOcupacaoCard key={b.id} b={b} rank={i + 1} />
                ))}
              </div>
            )}
          </div>

          {/* Retenção */}
          {retencao && (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold text-zinc-900">Taxa de Retorno de Clientes</h2>
                <p className="text-xs text-zinc-400 mt-0.5">% dos clientes atendidos no mês passado que voltaram este mês</p>
              </div>

              {/* Card geral */}
              <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-5 flex items-center gap-6">
                <div className="w-20 h-20 rounded-full border-4 border-amber-200 flex flex-col items-center justify-center shrink-0">
                  <span className="text-2xl font-black text-amber-600">{retencao.taxaGeralRetorno}%</span>
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">Barbearia geral</p>
                  <p className="text-sm text-zinc-500">
                    {retencao.totalRetornaram} de {retencao.totalLastMonth} clientes do mês passado retornaram
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {retencao.taxaGeralRetorno >= 60 ? "✅ Boa retenção" : retencao.taxaGeralRetorno >= 35 ? "⚠️ Retenção moderada" : "🔴 Retenção baixa — avaliar estratégias"}
                  </p>
                </div>
              </div>

              {/* Por barbeiro */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {retencao.porBarbeiro.map((b) => (
                  <div key={b.id} className="bg-white rounded-xl border border-zinc-100 shadow-sm p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <span className="text-amber-700 font-bold text-xs">{getInitials(b.name)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-zinc-900 text-sm truncate">{b.name}</p>
                        <p className="text-xs text-zinc-400">{b.totalClientesUnicos} clientes únicos</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-zinc-50 rounded-lg p-2 text-center">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <RefreshCw className="w-3 h-3 text-zinc-400" />
                          <span className="text-xs text-zinc-400">Retorno</span>
                        </div>
                        {b.taxaRetorno !== null ? (
                          <p className={`text-lg font-black ${b.taxaRetorno >= 60 ? "text-green-600" : b.taxaRetorno >= 35 ? "text-amber-600" : "text-red-500"}`}>
                            {b.taxaRetorno}%
                          </p>
                        ) : (
                          <p className="text-sm text-zinc-400">—</p>
                        )}
                        {b.clientesMesPassado > 0 && (
                          <p className="text-xs text-zinc-400">{b.clientesRetornaram}/{b.clientesMesPassado}</p>
                        )}
                      </div>
                      <div className="bg-zinc-50 rounded-lg p-2 text-center">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <Timer className="w-3 h-3 text-zinc-400" />
                          <span className="text-xs text-zinc-400">Frequência</span>
                        </div>
                        {b.mediaFrequencia !== null ? (
                          <p className={`text-lg font-black ${b.mediaFrequencia <= 21 ? "text-green-600" : b.mediaFrequencia <= 45 ? "text-amber-600" : "text-red-500"}`}>
                            {b.mediaFrequencia}d
                          </p>
                        ) : (
                          <p className="text-sm text-zinc-400">—</p>
                        )}
                        <p className="text-xs text-zinc-400">média entre visitas</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
