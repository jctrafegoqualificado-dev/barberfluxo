"use client";
import { useEffect, useState } from "react";
import {
  DollarSign, Percent, Hash, Edit2, Check, X,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, BadgeCheck, RotateCcw, Banknote, Trash2, Plus,
  Scissors, CreditCard, Printer, Download
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, getInitials } from "@/lib/utils";

interface Vale { id: string; amount: number; description: string | null; createdAt: string }

interface BarberComissao {
  id: string; name: string; email: string;
  commissionType: string; commission: number;
  productCommissionType: string; productCommission: number;
  avulso: { atendimentos: number; faturado: number; comissao: number; items: { date: string; clientName: string; serviceName: string; price: number }[] };
  assinatura: { servicos: number; ticketMedio: number; comissao: number; items: { date: string; clientName: string; serviceName: string; price: number }[] };
  produtos: { vendas: number; faturado: number; comissao: number };
  totalComissao: number;
  totalVales: number;
  liquidoAPagar: number;
  liquidoAssinatura: number;
  vales: Vale[];
  paid: { paidAt: string; amount: number } | null;
  subPaid: { paidAt: string; amount: number } | null;
}

type CommType = "PERCENTAGE" | "FIXED";

function TypeToggle({ value, onChange }: { value: CommType; onChange: (v: CommType) => void }) {
  return (
    <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange("PERCENTAGE")}
        className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${value === "PERCENTAGE" ? "bg-primary text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
      >
        <Percent className="w-3 h-3" /> %
      </button>
      <button
        type="button"
        onClick={() => onChange("FIXED")}
        className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${value === "FIXED" ? "bg-primary text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
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

function BarberCard({ barber, monthKey, monthOffset, activeTab, onSave, onPay, onUnpay, onAddVale, onDeleteVale }: {
  barber: BarberComissao;
  monthKey: string;
  monthOffset: number;
  activeTab: "standard" | "subscription";
  onSave: (id: string, data: ComissaoUpdate) => Promise<void>;
  onPay: (barberId: string, month: string, amount: number, type: string) => Promise<void>;
  onUnpay: (barberId: string, month: string, type: string) => Promise<void>;
  onAddVale: (barberId: string, month: string, amount: number, description: string) => Promise<void>;
  onDeleteVale: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payingSub, setPayingSub] = useState(false);
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

  async function handlePay(type: string, amount: number) {
    const label = type === "STANDARD" ? "serviços avulsos e produtos" : "comissão de assinaturas";
    if (!confirm(`Confirmar pagamento de ${formatCurrency(amount)} (${label}) para ${barber.name}?`)) return;
    if (type === "STANDARD") {
      setPaying(true);
      await onPay(barber.id, monthKey, amount, "STANDARD");
      setPaying(false);
    } else {
      setPayingSub(true);
      await onPay(barber.id, monthKey, amount, "SUBSCRIPTION");
      setPayingSub(false);
    }
  }

  async function handleUnpay(type: string) {
    const label = type === "STANDARD" ? "serviços avulsos" : "assinaturas";
    if (!confirm(`Desfazer o registro de pagamento das comissões de ${label}?`)) return;
    if (type === "STANDARD") {
      setPaying(true);
      await onUnpay(barber.id, monthKey, "STANDARD");
      setPaying(false);
    } else {
      setPayingSub(true);
      await onUnpay(barber.id, monthKey, "SUBSCRIPTION");
      setPayingSub(false);
    }
  }

  async function handleAddVale() {
    const amt = Number(valeAmount);
    if (!amt || amt <= 0) return;
    await onAddVale(barber.id, monthKey, amt, valeDesc);
    setValeAmount(""); setValeDesc(""); setShowValeForm(false);
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
    <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden flex flex-col justify-between">
      <div>
        <div className="p-5 pb-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-amber-700 font-bold">{getInitials(barber.name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-zinc-900">{barber.name}</p>
              <p className="text-xs text-zinc-400 truncate">{barber.email}</p>
            </div>
            {activeTab === "standard" && (
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
            )}
          </div>

          {activeTab === "standard" && (
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
                      className="w-24 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                      className="w-24 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
          )}

          {activeTab === "subscription" && (
            <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Métricas de Assinatura</p>
              <div className="flex items-center justify-between mt-3">
                <div>
                  <p className="text-[10px] text-zinc-500">Ticket Médio (Pool)</p>
                  <p className="font-semibold text-amber-900">{formatCurrency(barber.assinatura.ticketMedio)} <span className="text-[10px] font-normal text-amber-700">/ corte</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-zinc-500">Cortes Realizados</p>
                  <p className="font-semibold text-amber-900">{barber.assinatura.servicos}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Vales */}
        {activeTab === "standard" && (barber.vales.length > 0 || showValeForm) && (
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
                  className="w-28 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="text" placeholder="Descrição (opcional)"
                  value={valeDesc} onChange={(e) => setValeDesc(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button onClick={handleAddVale} className="px-2 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setShowValeForm(false)} className="px-2 py-1.5 rounded-lg border border-zinc-200 text-zinc-400 hover:bg-zinc-50">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col">
        {/* BLOCO 1: Serviços Avulsos & Vendas */}
        {activeTab === "standard" && (
          <div className="border-t border-zinc-100 p-4 bg-zinc-50/50">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">✂️ Avulsos & Produtos</p>
            {barber.paid ? (
              <div className="py-2 bg-green-50 rounded-xl px-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4 text-green-600 animate-bounce" />
                  <div>
                    <p className="text-xs font-semibold text-green-700">Pago — {formatCurrency(barber.paid.amount)}</p>
                    <p className="text-[10px] text-green-600">{new Date(barber.paid.paidAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
                <button onClick={() => handleUnpay("STANDARD")} disabled={paying}
                  className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-red-500 transition-colors">
                  <RotateCcw className="w-2.5 h-2.5" /> desfazer
                </button>
                <a href={`/painel/comissoes/recibo?barberId=${barber.id}&monthOffset=${monthOffset}&type=STANDARD`} target="_blank"
                  className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-700 transition-colors bg-white px-2 py-1 rounded-md border border-zinc-200">
                  <Printer className="w-3 h-3" /> recibo
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-zinc-400 font-medium">Líquido a Pagar</p>
                    <p className="text-base font-black text-zinc-800">{formatCurrency(barber.liquidoAPagar)}</p>
                    {barber.assinatura.comissao > 0 && (
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        Total c/ assinaturas: <span className="font-semibold text-zinc-600">{formatCurrency(barber.totalComissao - barber.totalVales)}</span>
                      </p>
                    )}
                  </div>
                  {barber.totalVales > 0 && (
                    <p className="text-[10px] text-red-500 font-bold">− {formatCurrency(barber.totalVales)} Vales</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowValeForm(true)} disabled={showValeForm}
                    className="px-2.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-[10px] font-semibold hover:bg-zinc-50 transition-colors flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Vale
                  </button>
                  <button onClick={() => handlePay("STANDARD", barber.liquidoAPagar)} disabled={paying || barber.liquidoAPagar === 0}
                    className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold hover:bg-primary/90 transition-colors disabled:opacity-40">
                    <Check className="w-3 h-3" />
                    {paying ? "..." : "Marcar como pago"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BLOCO 2: Assinaturas (Se houver atendimento no ciclo) */}
        {activeTab === "subscription" && barber.assinatura.servicos > 0 && (
          <div className="border-t border-zinc-100 p-4 bg-amber-50/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">💳 Clube de Assinaturas</p>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                {barber.assinatura.servicos} atendimentos
              </span>
            </div>
            {barber.subPaid ? (
              <div className="py-2 bg-green-50 rounded-xl px-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-xs font-semibold text-green-700">Pago — {formatCurrency(barber.subPaid.amount)}</p>
                    <p className="text-[10px] text-green-600">{new Date(barber.subPaid.paidAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
                <button onClick={() => handleUnpay("SUBSCRIPTION")} disabled={payingSub}
                  className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-red-500 transition-colors">
                  <RotateCcw className="w-2.5 h-2.5" /> desfazer
                </button>
                <a href={`/painel/comissoes/recibo?barberId=${barber.id}&monthOffset=${monthOffset}&type=SUBSCRIPTION`} target="_blank"
                  className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-700 transition-colors bg-white px-2 py-1 rounded-md border border-zinc-200">
                  <Printer className="w-3 h-3" /> recibo
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-amber-600/90 font-medium">Líquido Assinaturas</p>
                    <p className="text-base font-black text-amber-800">{formatCurrency(barber.liquidoAssinatura)}</p>
                  </div>
                  <p className="text-[9px] text-zinc-400 text-right">Pool Ticket:<br />{formatCurrency(barber.assinatura.ticketMedio)}/corte</p>
                </div>
                <button onClick={() => handlePay("SUBSCRIPTION", barber.liquidoAssinatura)} disabled={payingSub || barber.liquidoAssinatura === 0}
                  className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-[10px] font-bold hover:bg-amber-700 transition-colors disabled:opacity-40">
                  <Check className="w-3 h-3" />
                  {payingSub ? "..." : "Pagar Fechamento Assinaturas"}
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full px-5 py-2.5 flex items-center justify-between text-xs text-zinc-500 hover:bg-zinc-50 transition-colors border-t border-zinc-100"
        >
          <span>Ver detalhamento</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {expanded && (
          <div className="px-5 pb-4 space-y-3 border-t border-zinc-100 pt-3">
            {activeTab === "standard" && (
              <>
                <div className="flex flex-col gap-2 py-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-zinc-700">✂️ Serviços avulsos</p>
                      <p className="text-[10px] text-zinc-400">{barber.avulso.atendimentos} atend. · faturou {formatCurrency(barber.avulso.faturado)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-zinc-900">{formatCurrency(barber.avulso.comissao)}</p>
                      <p className="text-[9px] text-zinc-400">
                        {barber.commissionType === "PERCENTAGE"
                          ? `${barber.commission}% do faturado`
                          : `R$${barber.commission} × ${barber.avulso.atendimentos}`}
                      </p>
                    </div>
                  </div>
                  {barber.avulso.items?.length > 0 && (
                    <div className="mt-2 space-y-1 bg-zinc-50 rounded-lg p-2 max-h-40 overflow-y-auto">
                      {barber.avulso.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] text-zinc-600 border-b border-zinc-100 last:border-0 pb-1 last:pb-0">
                          <div>
                            <span className="font-medium">{item.clientName}</span>
                            <p className="text-zinc-400 text-[9px]">{new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} • {item.serviceName}</p>
                          </div>
                          <span className="font-medium text-zinc-800">{formatCurrency(item.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between py-1 border-t border-zinc-50 pt-2">
                  <div>
                    <p className="text-xs font-semibold text-zinc-700">📦 Produtos</p>
                    <p className="text-[10px] text-zinc-400">{barber.produtos.vendas} vendas · faturou {formatCurrency(barber.produtos.faturado)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-zinc-900">{formatCurrency(barber.produtos.comissao)}</p>
                    <p className="text-[9px] text-zinc-400">
                      {barber.productCommissionType === "PERCENTAGE"
                        ? `${barber.productCommission}% das vendas`
                        : `R$${barber.productCommission} × ${barber.produtos.vendas}`}
                    </p>
                  </div>
                </div>
              </>
            )}

            {activeTab === "subscription" && (
              <div className="flex flex-col gap-2 py-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-zinc-700">💳 Assinaturas</p>
                    <p className="text-[10px] text-zinc-400">{barber.assinatura.servicos} serviços realizados no plano</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-zinc-900">{formatCurrency(barber.assinatura.comissao)}</p>
                    <p className="text-[9px] text-zinc-400">
                      {formatCurrency(barber.assinatura.ticketMedio)} × {barber.assinatura.servicos}
                    </p>
                  </div>
                </div>
                {barber.assinatura.items?.length > 0 && (
                  <div className="mt-2 space-y-1 bg-zinc-50 rounded-lg p-2 max-h-40 overflow-y-auto">
                    {barber.assinatura.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[10px] text-zinc-600 border-b border-zinc-100 last:border-0 pb-1 last:pb-0">
                        <div>
                          <span className="font-medium text-amber-700">{item.clientName}</span>
                          <p className="text-zinc-400 text-[9px]">{new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} • {item.serviceName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
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
  const [activeTab, setActiveTab] = useState<"standard" | "subscription">("standard");

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

  async function handlePay(barberId: string, monthKeyStr: string, amount: number, type: string) {
    await fetch("/api/barbershop/comissoes/pagar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ barberId, month: monthKeyStr, amount, type }),
    });
    load(month);
  }

  async function handleUnpay(barberId: string, monthKeyStr: string, type: string) {
    await fetch("/api/barbershop/comissoes/pagar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ barberId, month: monthKeyStr, type }),
    });
    load(month);
  }

  async function handleAddVale(barberId: string, monthKeyStr: string, amount: number, description: string) {
    await fetch("/api/barbershop/comissoes/vale", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ barberId, month: monthKeyStr, amount, description }),
    });
    load(month);
  }

  async function handleDeleteVale(id: string) {
    await fetch("/api/barbershop/comissoes/vale", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    load(month);
  }

  const filteredBarbers = activeTab === "standard" 
    ? barbers 
    : barbers.filter((b) => b.assinatura.servicos > 0);

  const totalComissoes = activeTab === "standard"
    ? barbers.reduce((s, b) => s + (b.paid ? 0 : b.liquidoAPagar), 0)
    : barbers.reduce((s, b) => s + ((b.assinatura.servicos > 0 && !b.subPaid) ? b.liquidoAssinatura : 0), 0);

  const totalValesGeral = activeTab === "standard"
    ? barbers.reduce((s, b) => s + b.totalVales, 0)
    : 0;
  const totalPago = activeTab === "standard"
    ? barbers.reduce((s, b) => s + (b.paid ? b.paid.amount : 0), 0)
    : barbers.reduce((s, b) => s + (b.subPaid ? b.subPaid.amount : 0), 0);

  async function exportCSV() {
    let csv = "Barbeiro,Total Recebido,Total Vales,Liquido Pago\n";
    barbers.forEach(b => {
      const recebido = b.avulso.comissao + b.produtos.comissao + b.assinatura.comissao;
      const vales = b.totalVales;
      const pago = b.liquidoAPagar + b.liquidoAssinatura;
      csv += `${b.name},${recebido.toFixed(2)},${vales.toFixed(2)},${pago.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comissoes_${monthKey}.csv`;
    link.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Comissões</h1>
          <p className="text-zinc-500 text-sm mt-1 capitalize">{mes}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} className="flex items-center gap-2 bg-white border border-zinc-200 px-4 py-2 rounded-xl text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
            <Download className="w-4 h-4" /> CSV
          </button>
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
              <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-2 text-right">
                <p className="text-xs text-primary/90 font-medium">A pagar</p>
                <p className="text-xl font-black text-primary/90">{formatCurrency(totalComissoes)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200/50 max-w-md w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("standard")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "standard"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-950"
            }`}
          >
            <Scissors className="w-4 h-4" />
            Avulsos & Produtos
          </button>
          <button
            onClick={() => setActiveTab("subscription")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "subscription"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-950"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Club de Assinaturas
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 w-full sm:max-w-xl">
          <p className="font-semibold mb-1">Como funciona</p>
          <ul className="space-y-0.5 text-xs text-blue-600">
            {activeTab === "standard" ? (
              <>
                <li>• <strong>%</strong> — comissão proporcional ao valor do serviço/produto</li>
                <li>• <strong>R$ fixo</strong> — valor fixo por serviço ou venda realizada</li>
              </>
            ) : (
              <li>• <strong>Assinaturas</strong> — Comissões de planos recorrentes são separadas em um bloco próprio e pagas proporcionalmente de acordo com os atendimentos reais realizados no ciclo.</li>
            )}
          </ul>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filteredBarbers.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-100 p-16 text-center text-zinc-400">
          <DollarSign className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Nenhum profissional com dados nesta aba</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBarbers.map((b) => (
            <BarberCard key={b.id} barber={b} monthKey={monthKey} monthOffset={month} activeTab={activeTab} onSave={handleSave} onPay={handlePay} onUnpay={handleUnpay} onAddVale={handleAddVale} onDeleteVale={handleDeleteVale} />
          ))}
        </div>
      )}
    </div>
  );
}
