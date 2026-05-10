"use client";
import { useEffect, useState } from "react";
import {
  DollarSign, TrendingUp, Users, AlertTriangle,
  ArrowUpRight, Scissors, Settings2, Check, Banknote, Smartphone, CreditCard
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";

interface AvulsoMethod { count: number; bruto: number; taxa: number; liquido: number }

interface FinanceiroData {
  poeOwnerPct: number;
  poeBarberPct: number;
  debitFee: number;
  creditFee: number;
  poeTotal: number;
  poeBarbearia: number;
  poolBarbeiros: number;
  ticketPorServico: number;
  totalServicos: number;
  totalAssinantes: number;
  taxaUtilizacao: number;
  inadimplentes: number;
  novasMes: number;
  avulso: { bruto: number; liquido: number; taxaTotal: number; byMethod: Record<string, AvulsoMethod> };
  partilhaBarbeiros: { id: string; name: string; servicos: number; recebe: number }[];
  planos: { id: string; name: string; price: number; assinantes: number; receita: number }[];
}

function PoeBar({ ownerPct }: { ownerPct: number }) {
  return (
    <div className="w-full h-5 rounded-full overflow-hidden flex">
      <div
        className="bg-amber-500 flex items-center justify-center text-white text-xs font-bold transition-all"
        style={{ width: `${ownerPct}%` }}
      >
        {ownerPct > 10 ? `${ownerPct}%` : ""}
      </div>
      <div
        className="bg-blue-500 flex items-center justify-center text-white text-xs font-bold transition-all"
        style={{ width: `${100 - ownerPct}%` }}
      >
        {100 - ownerPct > 10 ? `${100 - ownerPct}%` : ""}
      </div>
    </div>
  );
}

export default function FinanceiroPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<FinanceiroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [poeInput, setPoeInput] = useState(50);
  const [savingPoe, setSavingPoe] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/barbershop/financeiro", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    setData(d);
    setPoeInput(d.poeOwnerPct ?? 50);
    setLoading(false);
  }

  useEffect(() => { load(); }, [token]);

  async function savePoe() {
    setSavingPoe(true);
    await fetch("/api/barbershop/financeiro", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ poeOwnerPct: poeInput }),
    });
    setSavingPoe(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Financeiro — Modelo POE</h1>
        <p className="text-zinc-500 text-sm mt-1">Distribuição do pote de assinaturas entre barbearia e barbeiros</p>
      </div>

      {/* Configuração do POE */}
      <div className="bg-zinc-900 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold">Configurar divisão do POE</h2>
          </div>
          <button
            onClick={savePoe}
            disabled={savingPoe}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saved ? <Check className="w-4 h-4" /> : null}
            {saved ? "Salvo!" : savingPoe ? "Salvando..." : "Salvar"}
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">
              % da Barbearia: <span className="text-amber-400 font-bold">{poeInput}%</span>
            </label>
            <input
              type="range" min={0} max={100} step={5}
              value={poeInput}
              onChange={(e) => setPoeInput(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">
              % dos Barbeiros: <span className="text-blue-400 font-bold">{100 - poeInput}%</span>
            </label>
            <input
              type="range" min={0} max={100} step={5}
              value={100 - poeInput}
              onChange={(e) => setPoeInput(100 - Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
        </div>
        <PoeBar ownerPct={poeInput} />
        <div className="flex justify-between text-xs text-zinc-400 mt-1">
          <span>🏠 Barbearia</span>
          <span>💈 Barbeiros</span>
        </div>
      </div>

      {/* Breakdown do POE */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border-2 border-zinc-200 p-5 text-center">
          <p className="text-xs text-zinc-500 mb-1 font-medium uppercase tracking-wide">POE Total</p>
          <p className="text-3xl font-black text-zinc-900">{formatCurrency(data.poeTotal)}</p>
          <p className="text-xs text-zinc-400 mt-1">{data.totalAssinantes} assinantes ativos</p>
        </div>
        <div className="bg-amber-50 rounded-xl border-2 border-amber-200 p-5 text-center">
          <p className="text-xs text-amber-600 mb-1 font-medium uppercase tracking-wide">🏠 Barbearia ({data.poeOwnerPct}%)</p>
          <p className="text-3xl font-black text-amber-600">{formatCurrency(data.poeBarbearia)}</p>
          <p className="text-xs text-amber-400 mt-1">Entra direto para o caixa</p>
        </div>
        <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-5 text-center">
          <p className="text-xs text-blue-600 mb-1 font-medium uppercase tracking-wide">💈 Pool Barbeiros ({data.poeBarberPct}%)</p>
          <p className="text-3xl font-black text-blue-600">{formatCurrency(data.poolBarbeiros)}</p>
          <p className="text-xs text-blue-400 mt-1">Dividido pelos serviços</p>
        </div>
      </div>

      {/* Ticket por serviço */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <DollarSign className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-zinc-500">Ticket médio por serviço</p>
            <p className="text-4xl font-black text-zinc-900">{formatCurrency(data.ticketPorServico)}</p>
            <p className="text-xs text-zinc-400 mt-1">
              Pool ({formatCurrency(data.poolBarbeiros)}) ÷ {data.totalServicos} serviços realizados este mês
            </p>
          </div>
        </div>
      </div>

      {/* Partilha por Barbeiro */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-zinc-900">Partilha por Barbeiro</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Cada serviço vale {formatCurrency(data.ticketPorServico)} · {data.totalServicos} serviços no total
            </p>
          </div>
          <Scissors className="w-5 h-5 text-zinc-300" />
        </div>

        {data.partilhaBarbeiros.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 text-sm">
            Nenhum atendimento de assinante registrado este mês
          </div>
        ) : (
          <>
            <div className="divide-y divide-zinc-50">
              {data.partilhaBarbeiros.map((b, i) => {
                const pctDoPool = data.poolBarbeiros > 0 ? (b.recebe / data.poolBarbeiros) * 100 : 0;
                return (
                  <div key={b.id} className="px-6 py-4">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <span className="text-blue-700 font-bold text-sm">{i + 1}º</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-zinc-900">{b.name}</p>
                          <p className="text-lg font-black text-blue-600">{formatCurrency(b.recebe)}</p>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-zinc-400">
                            {b.servicos} serviço{b.servicos !== 1 ? "s" : ""} × {formatCurrency(data.ticketPorServico)}
                          </p>
                          <p className="text-xs text-zinc-400">{pctDoPool.toFixed(1)}% do pool</p>
                        </div>
                      </div>
                    </div>
                    {/* Barra proporcional */}
                    <div className="w-full bg-zinc-100 rounded-full h-2">
                      <div
                        className="bg-blue-400 h-2 rounded-full transition-all"
                        style={{ width: `${pctDoPool}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totais */}
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Total distribuído aos barbeiros</span>
                <span className="font-bold text-zinc-900">{formatCurrency(data.poolBarbeiros)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-zinc-500">Barbearia retém</span>
                <span className="font-bold text-amber-600">{formatCurrency(data.poeBarbearia)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Caixa Avulso do mês */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-zinc-900">Caixa Avulso — Este Mês</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Serviços avulsos concluídos · Bruto vs Líquido após taxas</p>
          </div>
          <Banknote className="w-5 h-5 text-zinc-300" />
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="text-center">
              <p className="text-xs text-zinc-500 mb-1">Bruto</p>
              <p className="text-2xl font-black text-zinc-900">{formatCurrency(data.avulso.bruto)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-red-500 mb-1">Taxas cartão</p>
              <p className="text-2xl font-black text-red-500">-{formatCurrency(data.avulso.taxaTotal)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-green-600 mb-1">Líquido</p>
              <p className="text-2xl font-black text-green-600">{formatCurrency(data.avulso.liquido)}</p>
            </div>
          </div>

          {Object.keys(data.avulso.byMethod).length > 0 && (
            <div className="space-y-2 border-t border-zinc-100 pt-4">
              {[
                { key: "CASH", label: "Dinheiro", Icon: Banknote, color: "text-amber-600" },
                { key: "PIX", label: "PIX", Icon: Smartphone, color: "text-green-600" },
                { key: "DEBIT", label: "Débito", Icon: CreditCard, color: "text-blue-600", fee: data.debitFee },
                { key: "CREDIT", label: "Crédito", Icon: CreditCard, color: "text-purple-600", fee: data.creditFee },
              ].filter(({ key }) => data.avulso.byMethod[key]).map(({ key, label, Icon, color, fee }) => {
                const m = data.avulso.byMethod[key];
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <span className="text-zinc-700">{label}</span>
                      <span className="text-xs text-zinc-400">{m.count} serviço{m.count !== 1 ? "s" : ""}</span>
                      {fee ? <span className="text-xs text-red-400">taxa {fee}%</span> : null}
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      {m.taxa > 0 && <span className="text-xs text-red-400">-{formatCurrency(m.taxa)}</span>}
                      <span className="font-bold text-zinc-900">{formatCurrency(m.liquido)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {data.debitFee === 0 && data.creditFee === 0 && (
            <p className="text-xs text-zinc-400 text-center mt-2">
              Configure as taxas da máquina em <strong>Configurações</strong> para ver o líquido real
            </p>
          )}
        </div>
      </div>

      {/* Métricas extras */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-zinc-100 p-4 text-center">
          <Users className="w-5 h-5 text-zinc-300 mx-auto mb-1" />
          <p className="text-xl font-bold text-zinc-900">{data.totalAssinantes}</p>
          <p className="text-xs text-zinc-500">Assinantes ativos</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center">
          <ArrowUpRight className="w-5 h-5 text-green-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-700">+{data.novasMes}</p>
          <p className="text-xs text-green-600">Novos este mês</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 text-center">
          <TrendingUp className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-amber-700">{data.taxaUtilizacao}%</p>
          <p className="text-xs text-amber-600">Taxa de utilização</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${data.inadimplentes > 0 ? "bg-red-50 border-red-100" : "bg-zinc-50 border-zinc-200"}`}>
          <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${data.inadimplentes > 0 ? "text-red-500" : "text-zinc-300"}`} />
          <p className={`text-xl font-bold ${data.inadimplentes > 0 ? "text-red-700" : "text-zinc-400"}`}>{data.inadimplentes}</p>
          <p className={`text-xs ${data.inadimplentes > 0 ? "text-red-600" : "text-zinc-400"}`}>Inadimplentes</p>
        </div>
      </div>
    </div>
  );
}
