"use client";
import React from "react";
import { BarChart3, Sparkles, Crown } from "lucide-react";

interface NpsFidelitySectionProps {
  nps: {
    score: number | null;
    change: number | null;
    level: string;
    average: number;
    total: number;
    promoters: number;
    passives: number;
    detractors: number;
  };
}

export function NpsFidelitySection({ nps }: NpsFidelitySectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Termômetro NPS */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-150 shadow-sm p-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-zinc-900 text-sm">
              Termômetro de Satisfação (NPS)
            </h3>
          </div>
          {nps.score !== null && (
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                nps.level === "EXCELENTE"
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  : nps.level === "MUITO BOM"
                  ? "bg-blue-50 text-blue-600 border border-blue-100"
                  : nps.level === "CRÍTICO"
                  ? "bg-red-50 text-red-600 border border-red-100"
                  : "bg-amber-50 text-amber-600 border border-amber-100"
              }`}
            >
              Zona: {nps.level}
            </span>
          )}
        </div>

        {nps.score === null ? (
          <div className="flex flex-col items-center justify-center py-10 text-zinc-400 text-center">
            <Sparkles className="w-8 h-8 text-zinc-300 mb-2 animate-pulse" />
            <p className="text-sm font-medium">
              Nenhuma avaliação recebida ainda no período
            </p>
            <p className="text-[11px] text-zinc-400 mt-1 max-w-xs">
              Envie avaliações concluindo os atendimentos de hoje para calibrar o
              termômetro!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Círculo do Score */}
            <div className="flex flex-col items-center justify-center text-center p-4 bg-zinc-50 rounded-2xl border border-zinc-100 relative">
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-ping" />
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                NPS Score
              </p>
              <p
                className={`text-4xl font-black mt-2 tracking-tight ${
                  nps.score >= 75
                    ? "text-emerald-600"
                    : nps.score >= 50
                    ? "text-blue-500"
                    : nps.score >= 0
                    ? "text-amber-500"
                    : "text-red-500"
                }`}
              >
                {nps.score > 0 ? `+${nps.score}` : nps.score}
              </p>
              <div className="flex items-center gap-1 mt-2 text-xs font-bold text-zinc-500">
                <span>Média:</span>
                <span className="text-zinc-700">{nps.average} / 10</span>
              </div>
            </div>

            {/* Termômetro Linear */}
            <div className="md:col-span-2 space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-zinc-500">
                  <span>Evolução do Termômetro (-100 a +100)</span>
                  <span className="text-zinc-700">
                    {nps.score > 0 ? `+${nps.score}` : nps.score}
                  </span>
                </div>

                {/* Régua de Temperatura */}
                <div className="h-4 w-full rounded-full bg-zinc-100 p-0.5 border border-zinc-200 relative overflow-hidden flex">
                  <div className="w-1/2 h-full bg-red-100 border-r border-dashed border-red-300" />
                  <div className="w-1/4 h-full bg-amber-50 border-r border-dashed border-amber-200" />
                  <div className="w-1/4 h-full bg-emerald-50" />

                  {/* Indicador de Agulha */}
                  <div
                    className="absolute top-0 bottom-0 w-2.5 bg-zinc-900 border border-white rounded-full shadow-md transition-all duration-1000 -ml-1.5"
                    style={{ left: `${((nps.score + 100) / 200) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-zinc-400 font-bold uppercase tracking-wider px-1">
                  <span className="text-red-500">Crítico</span>
                  <span className="text-amber-500">Bom</span>
                  <span className="text-emerald-500">Excelente</span>
                </div>
              </div>

              {/* Proporção de Categorias */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100">
                <div className="space-y-1 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-zinc-500 font-bold">
                      Promotores
                    </span>
                  </div>
                  <p className="text-sm font-black text-emerald-600">
                    {nps.promoters}{" "}
                    <span className="text-[10px] text-zinc-400 font-medium">
                      (
                      {nps.total > 0
                        ? Math.round((nps.promoters / nps.total) * 100)
                        : 0}
                      %)
                    </span>
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[10px] text-zinc-500 font-bold">
                      Passivos
                    </span>
                  </div>
                  <p className="text-sm font-black text-amber-500">
                    {nps.passives}{" "}
                    <span className="text-[10px] text-zinc-400 font-medium">
                      (
                      {nps.total > 0
                        ? Math.round((nps.passives / nps.total) * 100)
                        : 0}
                      %)
                    </span>
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-[10px] text-zinc-500 font-bold">
                      Detratores
                    </span>
                  </div>
                  <p className="text-sm font-black text-red-500">
                    {nps.detractors}{" "}
                    <span className="text-[10px] text-zinc-400 font-medium">
                      (
                      {nps.total > 0
                        ? Math.round((nps.detractors / nps.total) * 100)
                        : 0}
                      %)
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gamificação de Fidelidade */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl border border-zinc-800 p-6 text-white relative overflow-hidden shadow-xl flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                Fidelidade SaaS
              </span>
            </div>
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>

          <h4 className="text-lg font-black tracking-tight text-white mb-2 leading-tight">
            Retenção Ativa via WhatsApp
          </h4>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            Cada atendimento concluído dispara uma pesquisa automatizada. A resposta
            gera engajamento imediato e fideliza o cliente!
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-zinc-800/40 rounded-xl p-4 border border-zinc-800/60 backdrop-blur-sm">
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              Avaliações
            </p>
            <p className="text-2xl font-black text-white mt-1">{nps.total}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              Pontos Gerados
            </p>
            <p className="text-2xl font-black text-amber-400 mt-1">
              {nps.total * 10} pts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
