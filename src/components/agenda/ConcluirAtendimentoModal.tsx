"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- plano vem cru da API (extraDiscount) */
import { useEffect, useState } from "react";
import { X, Trash2, Minus, Plus, Check, Crown } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import { type Appointment, servicesLabel, barberShortName, toMin, isOpenStatus } from "./types";

type Service = { id: string; name: string; price: number; duration: number };
type Product = { id: string; name: string; price: number; stock: number };

const METHODS = [
  { value: "PIX", label: "Pix", note: "na hora" },
  { value: "CASH", label: "Dinheiro", note: "vai pro caixa" },
  { value: "CREDIT_CARD", label: "Crédito", note: "maquininha" },
  { value: "DEBIT_CARD", label: "Débito", note: "maquininha" },
];

/**
 * Concluir atendimento / comanda (docs/design/Concluir-atendimento.dc.html).
 * Assinante: serviços do plano saem cobertos, só extras, produtos e gorjeta são cobrados.
 * A gorjeta vai à parte (tipAmount), 100% do profissional — nunca somada ao preço.
 */
export default function ConcluirAtendimentoModal({
  appt, services, products, discountSettings, onConfirm, onUpdateServices, onDelete, onReopen, onNoShow, onClose,
}: {
  appt: Appointment;
  services: Service[];
  products: Product[];
  discountSettings: { servicesEnabled: boolean; servicesMax: number };
  onConfirm: (id: string, m: string, p: number, extraPrice?: number, extraPaymentMethod?: string, discountPercent?: number, tipAmount?: number) => Promise<void>;
  onUpdateServices: (id: string, sids: string[]) => Promise<void>;
  onDelete: (id: string) => void;
  onReopen: (id: string) => Promise<void>;
  onNoShow: (id: string) => void;
  onClose: () => void;
}) {
  const { token } = useAuthStore();
  const isActiveSub = appt.subscription?.status === "ACTIVE";
  const planExtraDiscount = Number((appt.subscription?.plan as any)?.extraDiscount ?? 0);

  const [mode, setMode] = useState<"payment" | "edit">("payment");
  const [method, setMethod] = useState<string | null>(appt.status === "DONE" && appt.paymentMethod && appt.paymentMethod !== "SUBSCRIPTION" ? appt.paymentMethod : null);
  const [saving, setSaving] = useState(false);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [addingProduct, setAddingProduct] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    appt.services.length > 0 ? appt.services.map((s) => s.service.id) : appt.service?.id ? [appt.service.id] : []
  );
  const [tip, setTip] = useState(appt.tipAmount ? String(appt.tipAmount).replace(".", ",") : "");
  // Reabrindo uma comanda fechada, mantém o desconto dado; assinante começa com o desconto do plano nos extras.
  const [discountPercent, setDiscountPercent] = useState<number>(
    isActiveSub && planExtraDiscount > 0 ? planExtraDiscount : appt.status === "DONE" ? (appt.discountPercent ?? 0) : 0
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const planServiceIds = appt.subscription?.plan?.planServices?.map((ps) => ps.serviceId) ?? [];
  const selected = services.filter((s) => selectedServiceIds.includes(s.id));
  const servicesTotal = selected.reduce((s, x) => s + x.price, 0);
  const minutes = selected.reduce((s, x) => s + x.duration, 0) || (toMin(appt.endTime) - toMin(appt.startTime));
  const extras = isActiveSub ? selected.filter((s) => !planServiceIds.includes(s.id)) : [];
  const covered = isActiveSub ? selected.filter((s) => planServiceIds.includes(s.id)) : [];
  const extrasTotal = extras.reduce((s, x) => s + x.price, 0);

  const tipAmount = Math.max(0, Number(tip.replace(",", ".")) || 0);
  const productTotal = Object.entries(qtys).reduce((sum, [id, q]) => sum + (products.find((p) => p.id === id)?.price ?? 0) * q, 0);
  const discountBase = isActiveSub ? extrasTotal : servicesTotal;
  const discountValue = Math.round(discountBase * discountPercent) / 100;
  const chargedServices = Math.round((discountBase - discountValue) * 100) / 100;
  const total = chargedServices + productTotal + tipAmount;
  // Assinante sem extra, produto ou gorjeta não precisa escolher forma de pagamento.
  const needsMethod = !isActiveSub || chargedServices > 0 || tipAmount > 0 || productTotal > 0;

  const discountOptions = Array.from(new Set([0, 5, 10, 20, discountSettings.servicesMax].filter((p) => p <= discountSettings.servicesMax))).sort((a, b) => a - b);
  const showDiscount = discountSettings.servicesEnabled && discountBase > 0;

  function changeQty(id: string, delta: number) {
    setQtys((q) => {
      const next = Math.max(0, (q[id] ?? 0) + delta);
      if (next === 0) { const rest = { ...q }; delete rest[id]; return rest; }
      return { ...q, [id]: next };
    });
  }

  async function sellProducts(paymentMethod: string) {
    const toSell = Object.entries(qtys).filter(([, q]) => q > 0);
    await Promise.all(toSell.map(([pid, quantity]) =>
      fetch(`/api/barbershop/products/${pid}/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity, paymentMethod }),
      })
    ));
  }

  async function confirm() {
    if (needsMethod && !method) return;
    setSaving(true);
    const pay = method ?? "CASH";
    await sellProducts(pay);
    if (isActiveSub) {
      await onConfirm(appt.id, "SUBSCRIPTION", 0, chargedServices > 0 ? chargedServices : undefined, needsMethod ? pay : undefined, discountPercent > 0 ? discountPercent : undefined, tipAmount);
    } else {
      // Avulso: o preço gravado já vai com desconto (a API não desconta quando recebe o preço).
      await onConfirm(appt.id, pay, chargedServices, undefined, undefined, discountPercent > 0 ? discountPercent : undefined, tipAmount);
    }
    setSaving(false);
    onClose();
  }

  const open = isOpenStatus(appt.status);
  const closedOther = appt.status === "NO_SHOW" || appt.status === "CANCELLED";
  const barberName = barberShortName(appt.barber);
  const available = products.filter((p) => !(p.id in qtys));
  const sectionTitle = "text-[13px] font-semibold text-ink";
  const linkBtn = "text-[13px] font-semibold text-ink-2 underline underline-offset-2 hover:text-ink";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="conc-t"
        className="relative bg-surface w-full sm:max-w-[560px] sm:mx-4 rounded-t-[18px] sm:rounded-[18px] shadow-[0_20px_50px_rgba(27,25,22,0.18)] flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-line-2">
          <div className="min-w-0">
            <h2 id="conc-t" className="font-display text-[22px] font-bold">
              {mode === "edit" ? "Serviços feitos" : appt.status === "DONE" ? "Comanda" : open ? "Concluir atendimento" : "Atendimento"}
            </h2>
            <p className="text-sm text-ink-2 truncate">{appt.client.name} · {appt.startTime} com {barberName}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {mode === "payment" && (
              <button type="button" onClick={() => onDelete(appt.id)} aria-label="Excluir agendamento" title="Excluir agendamento"
                className="w-10 h-10 rounded-[10px] text-danger inline-flex items-center justify-center hover:bg-danger-soft">
                <Trash2 className="w-[18px] h-[18px]" />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Fechar" className="w-10 h-10 rounded-[10px] text-ink-2 inline-flex items-center justify-center hover:bg-surface-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {mode === "edit" ? (
          <>
            <div className="px-6 py-4 overflow-y-auto flex flex-col gap-1.5">
              {services.map((s) => {
                const on = selectedServiceIds.includes(s.id);
                return (
                  <label key={s.id} className={cn("flex items-center gap-3 px-3.5 min-h-12 rounded-[10px] cursor-pointer",
                    on ? "border-2 border-ink bg-ground" : "border border-control hover:bg-surface-3")}>
                    <input type="checkbox" checked={on} className="w-4 h-4 accent-[#1B1916]"
                      onChange={() => setSelectedServiceIds((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]))} />
                    <span className="flex-1 text-sm font-semibold">{s.name} <span className="font-normal text-ink-3">· {s.duration} min</span></span>
                    <span className="text-sm font-semibold">{formatCurrency(s.price)}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 px-6 pt-4 pb-5 border-t border-line-2">
              <button type="button" onClick={() => setMode("payment")} className="h-12 px-[18px] rounded-[10px] border border-control bg-surface text-sm font-semibold hover:bg-surface-3">Voltar</button>
              <button type="button" disabled={saving || selectedServiceIds.length === 0}
                onClick={async () => { setSaving(true); await onUpdateServices(appt.id, selectedServiceIds); setSaving(false); setMode("payment"); }}
                className="h-12 px-[22px] rounded-[10px] bg-ink text-white text-sm font-semibold disabled:opacity-40">
                {saving ? "Salvando…" : "Salvar serviços"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-5 px-6 py-[18px] overflow-y-auto">
              {/* Serviços */}
              <div className="flex flex-col">
                <div className="flex justify-between items-baseline pb-2">
                  <span className={sectionTitle}>Serviços</span>
                  {!closedOther && <button type="button" onClick={() => setMode("edit")} className={linkBtn}>Alterar</button>}
                </div>
                {isActiveSub ? (
                  <>
                    {covered.map((s) => (
                      <Line key={s.id} left={<>{s.name} <span className="text-ink-3">· {s.duration} min</span></>}
                        right={<span className="inline-flex items-center gap-1 text-primary text-[13px] font-semibold"><Crown className="w-3.5 h-3.5" aria-hidden />no plano</span>} />
                    ))}
                    {extras.map((s) => (
                      <Line key={s.id} left={<>{s.name} <span className="text-ink-3">· extra</span></>} right={formatCurrency(s.price)} />
                    ))}
                    <p className="text-xs text-ink-3 pt-1.5">Plano {appt.subscription?.plan.name}{appt.beneficiaryName ? ` · ${appt.beneficiaryName}` : ""}</p>
                  </>
                ) : (
                  <>
                    <Line left={<>{selected.length > 0 ? selected.map((s) => s.name).join(" + ") : servicesLabel(appt)} <span className="text-ink-3">· {minutes} min</span></>}
                      right={formatCurrency(servicesTotal)} />
                    {appt.subscription?.status === "OVERDUE" && (
                      <p className="text-xs text-danger pt-1.5">Assinatura em atraso: o plano não cobre este atendimento até regularizar.</p>
                    )}
                  </>
                )}
              </div>

              {/* Produtos */}
              {products.length > 0 && (
                <div className="flex flex-col">
                  <div className="flex justify-between items-baseline pb-2">
                    <span className={sectionTitle}>Produtos</span>
                    {available.length > 0 && <button type="button" onClick={() => setAddingProduct((v) => !v)} className={linkBtn}>+ Adicionar produto</button>}
                  </div>
                  {addingProduct && (
                    <div className="flex flex-wrap gap-1.5 pb-2">
                      {available.map((p) => (
                        <button key={p.id} type="button" onClick={() => { changeQty(p.id, 1); setAddingProduct(false); }}
                          className="h-9 px-3 rounded-full border border-control bg-surface text-[13px] font-semibold hover:bg-surface-3">
                          {p.name} · {formatCurrency(p.price)}
                        </button>
                      ))}
                    </div>
                  )}
                  {Object.entries(qtys).map(([id, q]) => {
                    const p = products.find((x) => x.id === id);
                    if (!p) return null;
                    return (
                      <div key={id} className="flex items-center gap-3 min-h-[52px] border-t border-line-3">
                        <div className="flex-1 min-w-0">
                          <span className="block text-sm truncate">{p.name}</span>
                          <span className="block text-xs text-ink-3">{formatCurrency(p.price)}{p.stock > 0 ? ` · ${p.stock} em estoque` : ""}</span>
                        </div>
                        <div className="flex items-center border border-control rounded-[9px]">
                          <button type="button" onClick={() => changeQty(id, -1)} aria-label={`Diminuir ${p.name}`} className="w-9 h-9 inline-flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                          <span className="w-[26px] text-center text-sm font-semibold">{q}</span>
                          <button type="button" onClick={() => changeQty(id, 1)} aria-label={`Aumentar ${p.name}`} className="w-9 h-9 inline-flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                        </div>
                        <span className="w-[78px] text-right text-sm font-semibold">{formatCurrency(p.price * q)}</span>
                      </div>
                    );
                  })}
                  {Object.keys(qtys).length === 0 && !addingProduct && <p className="text-[13px] text-ink-4 border-t border-line-3 pt-2.5">Nenhum produto vendido.</p>}
                </div>
              )}

              {/* Desconto e gorjeta */}
              <div className={cn("grid gap-4", showDiscount ? "grid-cols-1 sm:grid-cols-[1.4fr_1fr]" : "grid-cols-1")}>
                {showDiscount && (
                  <div className="flex flex-col gap-2">
                    <span className={sectionTitle}>Desconto {isActiveSub ? "nos extras" : "nos serviços"}</span>
                    <div role="group" aria-label="Desconto" className="flex p-1 gap-0.5 rounded-[10px] bg-track">
                      {discountOptions.map((p) => (
                        <button key={p} type="button" aria-pressed={discountPercent === p} onClick={() => setDiscountPercent(p)}
                          className={cn("flex-1 h-9 rounded-[7px] text-[13px] font-semibold",
                            discountPercent === p ? "bg-surface text-ink shadow-[0_1px_2px_rgba(27,25,22,0.12)]" : "text-ink-2")}>
                          {p === 0 ? "Sem" : `${p}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label htmlFor="gorjeta" className={sectionTitle}>Gorjeta para {barberName}</label>
                  <div className="flex items-center h-11 border border-control rounded-[10px] px-3 gap-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                    <span className="text-sm text-ink-3">R$</span>
                    <input id="gorjeta" type="text" inputMode="decimal" value={tip} placeholder="0,00"
                      onChange={(e) => setTip(e.target.value.replace(/[^\d,.]/g, ""))}
                      className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-semibold placeholder:text-ink-4 placeholder:font-normal" />
                  </div>
                </div>
              </div>

              {/* Forma de pagamento */}
              {needsMethod ? (
                <div className="flex flex-col gap-2">
                  <span className={sectionTitle}>{isActiveSub ? "Como pagou o que não é do plano?" : "Como o cliente pagou?"}</span>
                  <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {METHODS.map((m) => {
                      const on = method === m.value;
                      return (
                        <button key={m.value} type="button" role="radio" aria-checked={on} onClick={() => setMethod(m.value)}
                          className={cn("h-[70px] rounded-[10px] flex flex-col items-center justify-center gap-1",
                            on ? "border-2 border-ink bg-ink text-white" : "border border-control bg-surface text-ink hover:bg-surface-3")}>
                          <span className="text-sm font-semibold">{m.label}</span>
                          <span className="text-[11px] opacity-85">{m.note}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-positive bg-positive-soft rounded-[10px] px-3.5 py-2.5 inline-flex items-center gap-2">
                  <Check className="w-4 h-4" aria-hidden /> Tudo coberto pelo plano. Nada a cobrar.
                </p>
              )}

              {/* Resumo */}
              <div className="flex flex-col gap-2 px-4 py-3.5 rounded-xl bg-ground text-sm text-ink-2">
                <Sum label={isActiveSub ? "Extras" : "Serviços"} value={formatCurrency(discountBase)} />
                {productTotal > 0 && <Sum label="Produtos" value={formatCurrency(productTotal)} />}
                {discountValue > 0 && <Sum label={`Desconto (${discountPercent}%)`} value={`− ${formatCurrency(discountValue)}`} />}
                {tipAmount > 0 && <Sum label="Gorjeta" value={formatCurrency(tipAmount)} />}
                <div className="flex justify-between items-baseline pt-2 border-t border-control">
                  <span className="text-[15px] font-semibold text-ink">Total</span>
                  <span className="font-display text-[26px] font-bold text-ink">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-5 border-t border-line-2">
              {open ? (
                <>
                  <button type="button" onClick={() => onNoShow(appt.id)} className="h-12 px-3.5 text-danger-strong text-sm font-semibold hover:underline">Marcar como falta</button>
                  <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="h-12 px-[18px] rounded-[10px] border border-control bg-surface text-sm font-semibold hover:bg-surface-3">Voltar</button>
                    <button type="button" onClick={confirm} disabled={saving || (needsMethod && !method)}
                      className="h-12 px-[22px] rounded-[10px] bg-primary hover:bg-primary/90 text-white text-[15px] font-semibold inline-flex items-center gap-2 disabled:opacity-40">
                      <Check className="w-4 h-4" aria-hidden />
                      {saving ? "Salvando…" : `Concluir · ${formatCurrency(total)}`}
                    </button>
                  </div>
                </>
              ) : appt.status === "DONE" ? (
                <>
                  <button type="button" disabled={saving} onClick={async () => { setSaving(true); await onReopen(appt.id); setSaving(false); onClose(); }}
                    className="h-12 px-3.5 text-ink-2 text-sm font-semibold hover:underline">Reabrir atendimento</button>
                  <button type="button" onClick={confirm} disabled={saving || (needsMethod && !method)}
                    className="h-12 px-[22px] rounded-[10px] bg-ink text-white text-sm font-semibold disabled:opacity-40">
                    {saving ? "Salvando…" : "Salvar alterações"}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { onDelete(appt.id); onClose(); }} className="h-12 px-3.5 text-danger-strong text-sm font-semibold hover:underline">Excluir</button>
                  <button type="button" disabled={saving} onClick={async () => { setSaving(true); await onReopen(appt.id); setSaving(false); onClose(); }}
                    className="h-12 px-[22px] rounded-[10px] bg-ink text-white text-sm font-semibold">Reabrir</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Line({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 min-h-[46px] border-t border-line-3">
      <span className="flex-1 text-sm min-w-0">{left}</span>
      <span className="text-sm font-semibold shrink-0">{right}</span>
    </div>
  );
}

function Sum({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span>{label}</span><span>{value}</span></div>;
}
