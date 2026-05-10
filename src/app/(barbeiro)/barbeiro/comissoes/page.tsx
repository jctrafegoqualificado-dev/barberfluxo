"use client";
import { useEffect, useState } from "react";
import { DollarSign, Scissors, CreditCard, Package, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";

interface AvulsoItem {
  id: string; date: string; time: string; client: string;
  service: string; valor: number; comissao: number; tipo: "avulso";
}
interface AssinaturaItem {
  id: string; date: string; time: string; client: string;
  service: string; plano: string; valor: number; comissao: number; tipo: "assinatura";
}
interface ProdutoItem {
  id: string; date: string; client: string;
  product: string; qty: number; valor: number; comissao: number; tipo: "produto";
}
interface Resumo {
  avulso: { atendimentos: number; faturado: number; comissao: number };
  assinatura: { atendimentos: number; faturado: number; comissao: number };
  produtos: { vendas: number; faturado: number; comissao: number };
  totalComissao: number;
}
interface ComissoesData {
  barber: { name: string; commissionType: string; commission: number; productCommissionType: string; productCommission: number };
  mes: string;
  monthOffset: number;
  resumo: Resumo;
  itens: { avulso: AvulsoItem[]; assinatura: AssinaturaItem[]; produtos: ProdutoItem[] };
}

type Tab = "avulso" | "assinatura" | "produtos";

function RateBadge({ type, rate }: { type: string; rate: number }) {
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      {type === "PERCENTAGE" ? `${rate}% do valor` : `R$${rate} fixo`}
    </span>
  );
}

function formatDateBR(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function ComissoesBarberPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<ComissoesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(0);
  const [tab, setTab] = useState<Tab>("avulso");

  async function load(m: number) {
    setLoading(true);
    const r = await fetch(`/api/barber/comissoes?month=${m}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    setData(d);
    setLoading(false);
  }

  useEffect(() => { load(month); }, [month]);

  function prevMonth() { setMonth((m) => m + 1); }
  function nextMonth() { if (month > 0) setMonth((m) => m - 1); }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!data) return null;

  const { barber, resumo, itens, mes } = data;

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number; comissao: number }[] = [
    {
      key: "avulso",
      label: "Avulsos",
      icon: <Scissors className="w-4 h-4" />,
      count: resumo.avulso.atendimentos,
      comissao: resumo.avulso.comissao,
    },
    {
      key: "assinatura",
      label: "Assinaturas",
      icon: <CreditCard className="w-4 h-4" />,
      count: resumo.assinatura.atendimentos,
      comissao: resumo.assinatura.comissao,
    },
    {
      key: "produtos",
      label: "Produtos",
      icon: <Package className="w-4 h-4" />,
      count: resumo.produtos.vendas,
      comissao: resumo.produtos.comissao,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Navegação de mês */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Minhas Comissões</h1>
          <p className="text-zinc-500 text-sm mt-0.5 capitalize">{mes}</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-zinc-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-zinc-500" />
          </button>
          <span className="text-sm font-medium text-zinc-700 min-w-[110px] text-center capitalize">{mes}</span>
          <button onClick={nextMonth} disabled={month === 0} className="p-1 rounded hover:bg-zinc-100 transition-colors disabled:opacity-30">
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      </div>

      {/* Taxas configuradas */}
      <div className="bg-zinc-50 rounded-xl border border-zinc-200 px-5 py-3 flex flex-wrap items-center gap-3">
        <span className="text-xs text-zinc-500 font-medium">Suas taxas:</span>
        <span className="text-xs text-zinc-600 flex items-center gap-1">
          <Scissors className="w-3 h-3" /> Serviços:
        </span>
        <RateBadge type={barber.commissionType} rate={barber.commission} />
        <span className="text-xs text-zinc-600 flex items-center gap-1 ml-2">
          <Package className="w-3 h-3" /> Produtos:
        </span>
        <RateBadge type={barber.productCommissionType} rate={barber.productCommission} />
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="col-span-2 bg-amber-500 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-5 h-5 opacity-80" />
            <span className="text-sm font-medium opacity-90">Total a receber</span>
          </div>
          <p className="text-3xl font-black">{formatCurrency(resumo.totalComissao)}</p>
          <p className="text-xs opacity-70 mt-1">
            {resumo.avulso.atendimentos + resumo.assinatura.atendimentos} atend. + {resumo.produtos.vendas} vendas
          </p>
        </div>

        <div className="bg-white rounded-xl border border-zinc-100 p-5">
          <div className="flex items-center gap-2 mb-1 text-zinc-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">Faturado total</span>
          </div>
          <p className="text-xl font-bold text-zinc-900">
            {formatCurrency(resumo.avulso.faturado + resumo.assinatura.faturado + resumo.produtos.faturado)}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">gerado pela barbearia</p>
        </div>

        <div className="bg-white rounded-xl border border-zinc-100 p-5">
          <p className="text-xs text-zinc-400 mb-1">Atendimentos</p>
          <p className="text-2xl font-bold text-zinc-900">
            {resumo.avulso.atendimentos + resumo.assinatura.atendimentos}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">{resumo.produtos.vendas} produtos vendidos</p>
        </div>
      </div>

      {/* Mini breakdown por categoria */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Avulsos", icon: <Scissors className="w-4 h-4" />, faturado: resumo.avulso.faturado, comissao: resumo.avulso.comissao, count: resumo.avulso.atendimentos, unit: "atend." },
          { label: "Assinaturas", icon: <CreditCard className="w-4 h-4" />, faturado: resumo.assinatura.faturado, comissao: resumo.assinatura.comissao, count: resumo.assinatura.atendimentos, unit: "atend." },
          { label: "Produtos", icon: <Package className="w-4 h-4" />, faturado: resumo.produtos.faturado, comissao: resumo.produtos.comissao, count: resumo.produtos.vendas, unit: "vendas" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-zinc-100 p-4">
            <div className="flex items-center gap-2 mb-3 text-zinc-500">
              {c.icon}
              <span className="text-xs font-semibold">{c.label}</span>
            </div>
            <p className="text-lg font-bold text-zinc-900">{formatCurrency(c.comissao)}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{c.count} {c.unit} · {formatCurrency(c.faturado)} fat.</p>
          </div>
        ))}
      </div>

      {/* Tabs + listagem detalhada */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-zinc-100">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${
                tab === t.key
                  ? "border-amber-500 text-amber-600 bg-amber-50"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Lista avulsos */}
        {tab === "avulso" && (
          <div className="divide-y divide-zinc-50">
            {itens.avulso.length === 0 ? (
              <p className="py-10 text-center text-zinc-400 text-sm">Nenhum atendimento avulso neste mês</p>
            ) : itens.avulso.map((a) => (
              <div key={a.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="text-center w-14 shrink-0">
                  <p className="text-xs font-semibold text-zinc-700">{formatDateBR(a.date)}</p>
                  <p className="text-xs text-zinc-400">{a.time}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{a.client}</p>
                  <p className="text-xs text-zinc-400 truncate">{a.service}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-zinc-400">{formatCurrency(a.valor)}</p>
                  <p className="text-sm font-bold text-amber-600">+{formatCurrency(a.comissao)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lista assinaturas */}
        {tab === "assinatura" && (
          <div className="divide-y divide-zinc-50">
            {itens.assinatura.length === 0 ? (
              <p className="py-10 text-center text-zinc-400 text-sm">Nenhum atendimento de assinatura neste mês</p>
            ) : itens.assinatura.map((a) => (
              <div key={a.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="text-center w-14 shrink-0">
                  <p className="text-xs font-semibold text-zinc-700">{formatDateBR(a.date)}</p>
                  <p className="text-xs text-zinc-400">{a.time}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{a.client}</p>
                  <p className="text-xs text-zinc-400 truncate">{a.service}</p>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">{a.plano}</span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-zinc-400">{formatCurrency(a.valor)}</p>
                  <p className="text-sm font-bold text-amber-600">+{formatCurrency(a.comissao)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lista produtos */}
        {tab === "produtos" && (
          <div className="divide-y divide-zinc-50">
            {itens.produtos.length === 0 ? (
              <p className="py-10 text-center text-zinc-400 text-sm">Nenhum produto vendido neste mês</p>
            ) : itens.produtos.map((p) => (
              <div key={p.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="text-center w-14 shrink-0">
                  <p className="text-xs font-semibold text-zinc-700">{formatDateBR(p.date as unknown as string)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{p.product}</p>
                  <p className="text-xs text-zinc-400">{p.client} · {p.qty}x</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-zinc-400">{formatCurrency(p.valor)}</p>
                  <p className="text-sm font-bold text-amber-600">+{formatCurrency(p.comissao)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
