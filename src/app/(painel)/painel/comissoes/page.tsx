"use client";
import { useEffect, useState } from "react";
import {
  DollarSign, Percent, Hash, Edit2, Check, X,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, BadgeCheck, RotateCcw, Banknote, Trash2, Plus,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, getInitials } from "@/lib/utils";

interface Vale { id: string; amount: number; description: string | null; createdAt: string }

interface BarberComissao {
  id: string; name: string; email: string;
  commissionType: string; commission: number;
  productCommissionType: string; productCommission: number;
  avulso: { atendimentos: number; faturado: number; comissao: number };
  assinatura: { servicos: number; faturado: number; comissao: number };
  produtos: { vendas: number; faturado: number; comissao: number };
  totalComissao: number;
  totalVales: number;
  liquidoAPagar: number;
  vales: Vale[];
  paid: { paidAt: string; amount: number } | null;
}

type CommType = "PERCENTAGE" | "FIXED";

function TypeToggle({ value, onChange }: { value: CommType; onChange: (v: CommType) => void }) {
  return (
    <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange("PERCENTAGE")}
        className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${value === "PERCENTAGE" ? "bg-amber-500 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
      >
        <Percent className="w-3 h-3" /> %
      </button>
      <button
        type="button"
        onClick={() => onChange("FIXED")}
        className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${value === "FIXED" ? "bg-amber-500 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
      >
        <Hash className="w-3 h-3" /> R$
      </button>
    </div>
  );
}

interface ComissaoUpdate {
  commissionType: CommType;
  commission: string;
  productCommissionType: CommType;
  productCommission: string;
}

function BarberCard({ barber, monthKey, onSave, onPay, onUnpay, onAddVale, onDeleteVale }: {
  barber: BarberComissao;
  monthKey: string;
  onSave: (id: string, data: ComissaoUpdate) => Promise<void>;
  onPay: (barberId: string, month: string, amount: number) => Promise<void>;
  onUnpay: (barberId: string, month: string) => Promise<void>;
  onAddVale: (barberId: string, month: string, amount: number, description: string) => Promise<void>;
  onDeleteVale: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [showValeForm, setShowValeForm] = useState(false);
  const [valeAmount, setValeAmount] = useState("");
  const [valeDesc, setValeDesc] = useState("");
  const [form, setForm] = useState({
    commissionType: barber.commissionType as CommType,
    commission: String(barber.commission),
    productCommissionType: barber.productCommissionType as CommType,
    productCommission: String(barber.productCommission),
  });

  async function handleSave() {
    setSaving(true);
    await onSave(barber.id, form);
    setSaving(false);
    setEditing(false);
  }

  async function handlePay() {
    if (!confirm(`Confirmar pagamento de ${formatCurrency(barber.liquidoAPagar)} para ${barber.name}?`)) return;
    setPaying(true);
    await onPay(barber.id, monthKey, barber.liquidoAPagar);
    setPaying(false);
  }

  async function handleAddVale() {
    const amt = Number(valeAmount);
    if (!amt || amt <= 0) return;
    await onAddVale(barber.id, monthKey, amt, valeDesc);
    setValeAmount(""); setValeDesc(""); setShowValeForm(false);
  }

  async function handleUnpay() {
    if (!confirm("Desfazer o registro de pagamento desta comissão?")) return;
    setPaying(true);
    await onUnpay(barber.id, monthKey);
    setPaying(false);
  }

  function cancelEdit() {
    setForm({
      commissionType: barber.commissionType as CommType,
      commission: String(barber.commission),
      productCommissionType: barber.productCommissionType as CommType,
      productCommission: String(barber.productCommission),
    });
    setEditing(false);
  }

  const commLabel = barber.commissionType === "PERCENTAGE"
    ? `${barber.commission}% dos serviços avulsos`
    : `R$${barber.commission} fixo por serviço avulso`;

  const prodLabel = barber.productCommissionType === "PERCENTAGE"
    ? `${barber.productCommission}% dos produtos`
    : `R$${barber.productCommission} fixo por produto vendido`;

  return (
    <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <span className="text-amber-700 font-bold">{getInitials(barber.name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-zinc-900">{barber.name}</p>
            <p className="text-xs text-zinc-400 truncate">{barber.email}</p>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={handleSave} disabled={saving}
                  className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={cancelEdit}
                  className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors">
                <Edit2 className="w-4 h-4 text-zinc-500" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className={`rounded-xl p-4 ${editing ? "bg-zinc-50 border border-zinc-200" : "bg-zinc-50"}`}>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">✂️ Serviços Avulsos</p>
            {editing ? (
              <div className="flex items-center gap-2">
                <TypeToggle value={form.commissionType} onChange={(v) => setForm((f) => ({ ...f, commissionType: v }))} />
                <input
                  type="number" min="0" step={form.commissionType === "PERCENTAGE" ? "1" : "0.01"}
                  max={form.commissionType === "PERCENTAGE" ? "100" : undefined}
                  value={form.commission}
                  onChange={(e) => setForm((f) => ({ ...f, commission: e.target.value }))}
                  className="w-24 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-sm text-zinc-500">
                  {form.commissionType === "PERCENTAGE" ? "%" : "R$ por serviço"}
                </span>
              </div>
            ) : (
              <p className="text-sm font-medium text-zinc-800">{commLabel}</p>
            )}
          </div>

          <div className={`rounded-xl p-4 ${editing ? "bg-zinc-50 border border-zinc-200" : "bg-zinc-50"}`}>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">📦 Produtos</p>
            {editing ? (
              <div className="flex items-center gap-2">
                <TypeToggle value={form.productCommissionType} onChange={(v) => setForm((f) => ({ ...f, productCommissionType: v }))} />
                <input
                  type="number" min="0" step={form.productCommissionType === "PERCENTAGE" ? "1" : "0.01"}
                  max={form.productCommissionType === "PERCENTAGE" ? "100" : undefined}
                  value={form.productCommission}
                  onChange={(e) => setForm((f) => ({ ...f, productCommission: e.target.value }))}
                  className="w-24 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-sm text-zinc-500">
                  {form.productCommissionType === "PERCENTAGE" ? "%" : "R$ por venda"}
                </span>
              </div>
            ) : (
              <p className="text-sm font-medium text-zinc-800">{prodLabel}</p>
            )}
          </div>
        </div>
      </div>

      {/* Vales */}
      {(barber.vales.length > 0 || showValeForm) && (
        <div className="px-5 py-3 border-t border-zinc-100 space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5" /> Vales do mês
          </p>
          {barber.vales.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-zinc-700">{formatCurrency(v.amount)}</span>
                {v.description && <span className="text-zinc-400 ml-2 text-xs">{v.description}</span>}
              </div>
              <button onClick={() => onDeleteVale(v.id)} className="p-1 text-zinc-300 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {showValeForm && (
            <div className="flex gap-2 mt-1">
              <input
                type="number" min="0" step="0.01" placeholder="R$ valor"
                value={valeAmount} onChange={(e) => setValeAmount(e.target.value)}
                className="w-28 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <input
                type="text" placeholder="Descrição (opcional)"
                value={valeDesc} onChange={(e) => setValeDesc(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button onClick={handleAddVale} className="px-2 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setShowValeForm(false)} className="px-2 py-1.5 rounded-lg border border-zinc-200 text-zinc-400 hover:bg-zinc-50">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {barber.paid ? (
        <div className="px-5 py-3 bg-green-50 border-t border-green-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-700">Pago — {formatCurrency(barber.paid.amount)}</p>
              <p className="text-xs text-green-600">{new Date(barber.paid.paidAt).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
          <button onClick={handleUnpay} disabled={paying}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-red-500 transition-colors">
            <RotateCcw className="w-3 h-3" /> desfazer
          </button>
        </div>
      ) : (
        <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-xs text-amber-600 font-medium">Comissão bruta</p>
              <p className="text-sm font-bold text-zinc-600">{formatCurrency(barber.totalComissao)}</p>
            </div>
            {barber.totalVales > 0 && (
              <div className="text-right">
                <p className="text-xs text-zinc-500">− Vales</p>
                <p className="text-sm font-bold text-red-500">−{formatCurrency(barber.totalVales)}</p>
              </div>
            )}
            <div className="text-right">
              <p className="text-xs text-amber-600 font-medium">A pagar</p>
              <p className="text-lg font-black text-amber-600">{formatCurrency(barber.liquidoAPagar)}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setShowValeForm(true)} disabled={showValeForm}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Vale
            </button>
            <button onClick={handlePay} disabled={paying || barber.liquidoAPagar === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors disabled:opacity-40">
              <Check className="w-3.5 h-3.5" />
              {paying ? "..." : "Marcar como pago"}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-5 py-3 flex items-center justify-between text-sm text-zinc-500 hover:bg-zinc-50 transition-colors border-t border-zinc-100"
      >
        <span>Ver detalhamento</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3 border-t border-zinc-100">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-zinc-700">✂️ Serviços avulsos</p>
              <p className="text-xs text-zinc-400">{barber.avulso.atendimentos} atend. · faturou {formatCurrency(barber.avulso.faturado)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-zinc-900">{formatCurrency(barber.avulso.comissao)}</p>
              <p className="text-xs text-zinc-400">
                {barber.commissionType === "PERCENTAGE"
                  ? `${barber.commission}% do faturado`
                  : `R$${barber.commission} × ${barber.avulso.atendimentos}`}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-zinc-50">
            <div>
              <p className="text-sm font-medium text-zinc-700">💳 Assinaturas</p>
              <p className="text-xs text-zinc-400">{barber.assinatura.servicos} serviços · faturou {formatCurrency(barber.assinatura.faturado)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-zinc-900">{formatCurrency(barber.assinatura.comissao)}</p>
              <p className="text-xs text-zinc-400">
                {barber.commissionType === "PERCENTAGE"
                  ? `${barber.commission}% do faturado`
                  : `R$${barber.commission} × ${barber.assinatura.servicos}`}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-zinc-50">
            <div>
              <p className="text-sm font-medium text-zinc-700">📦 Produtos</p>
              <p className="text-xs text-zinc-400">{barber.produtos.vendas} vendas · faturou {formatCurrency(barber.produtos.faturado)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-zinc-900">{formatCurrency(barber.produtos.comissao)}</p>
              <p className="text-xs text-zinc-400">
                {barber.productCommissionType === "PERCENTAGE"
                  ? `${barber.productCommission}% das vendas`
                  : `R$${barber.productCommission} × ${barber.produtos.vendas}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComissoesPage() {
  const { token } = useAuthStore();
  const [barbers, setBarbers] = useState<BarberComissao[]>([]);
  const [mes, setMes] = useState("");
  const [monthKey, setMonthKey] = useState("");
  const [month, setMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load(m: number) {
    setLoading(true);
    const r = await fetch(`/api/barbershop/comissoes?month=${m}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    setBarbers(d.barbers || []);
    setMes(d.mes || "");
    setMonthKey(d.monthKey || "");
    setLoading(false);
  }

  useEffect(() => { load(month); }, [month]);

  async function handleSave(barberId: string, data: ComissaoUpdate) {
    await fetch("/api/barbershop/comissoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ barberId, ...data }),
    });
    load(month);
  }

  async function handlePay(barberId: string, month: string, amount: number) {
    await fetch("/api/barbershop/comissoes/pagar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ barberId, month, amount }),
    });
    load(0);
    setMonth(0);
  }

  async function handleUnpay(barberId: string, month: string) {
    await fetch("/api/barbershop/comissoes/pagar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ barberId, month }),
    });
    load(0);
    setMonth(0);
  }

  async function handleAddVale(barberId: string, month: string, amount: number, description: string) {
    await fetch("/api/barbershop/comissoes/vale", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ barberId, month, amount, description }),
    });
    load(month === monthKey ? 0 : -1);
  }

  async function handleDeleteVale(id: string) {
    await fetch("/api/barbershop/comissoes/vale", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    load(month);
  }

  const totalComissoes = barbers.filter((b) => !b.paid).reduce((s, b) => s + b.liquidoAPagar, 0);
  const totalValesGeral = barbers.reduce((s, b) => s + b.totalVales, 0);
  const totalPago = barbers.filter((b) => b.paid).reduce((s, b) => s + (b.paid?.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Comissões</h1>
          <p className="text-zinc-500 text-sm mt-1 capitalize">{mes}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2">
            <button onClick={() => setMonth((m) => m + 1)} className="p-1 rounded hover:bg-zinc-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-zinc-500" />
            </button>
            <span className="text-sm font-medium text-zinc-700 min-w-[120px] text-center capitalize">{mes}</span>
            <button onClick={() => setMonth((m) => m - 1)} disabled={month === 0} className="p-1 rounded hover:bg-zinc-100 transition-colors disabled:opacity-30">
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
          {!loading && barbers.length > 0 && (
            <div className="flex gap-2">
              {totalValesGeral > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-right">
                  <p className="text-xs text-red-500 font-medium">Vales</p>
                  <p className="text-base font-black text-red-500">{formatCurrency(totalValesGeral)}</p>
                </div>
              )}
              {totalPago > 0 && (
                <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2 text-right">
                  <p className="text-xs text-green-600 font-medium">Pago</p>
                  <p className="text-base font-black text-green-600">{formatCurrency(totalPago)}</p>
                </div>
              )}
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 text-right">
                <p className="text-xs text-amber-600 font-medium">A pagar</p>
                <p className="text-xl font-black text-amber-600">{formatCurrency(totalComissoes)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">Como funciona</p>
        <ul className="space-y-0.5 text-xs text-blue-600">
          <li>• <strong>%</strong> — comissão proporcional ao valor do serviço/produto (ex: 50% de R$45 = R$22,50)</li>
          <li>• <strong>R$ fixo</strong> — valor fixo por serviço ou venda realizada, independente do preço (ex: R$15 por corte)</li>
          <li>• <strong>Assinatura</strong> — calculada com a mesma taxa de serviços sobre os atendimentos realizados</li>
        </ul>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : barbers.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-100 p-16 text-center text-zinc-400">
          <DollarSign className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhum barbeiro cadastrado</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {barbers.map((b) => (
            <BarberCard key={b.id} barber={b} monthKey={monthKey} onSave={handleSave} onPay={handlePay} onUnpay={handleUnpay} onAddVale={handleAddVale} onDeleteVale={handleDeleteVale} />
          ))}
        </div>
      )}
    </div>
  );
}
