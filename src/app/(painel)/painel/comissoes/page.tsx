"use client";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarRange, ChevronDown, ChevronLeft, ChevronRight, Download, Plus, Printer, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { parseMoney } from "@/lib/finance";
import type { CommissionRow } from "@/lib/commissions";

type Barber = CommissionRow;
type PayType = "STANDARD" | "SUBSCRIPTION";
interface Data {
  barbers: Barber[];
  mes: string;
  monthKey: string;
  isCurrent: boolean;
  isRange: boolean;
  /** Mês já fechado: as assinaturas podem ser pagas */
  closed: boolean;
  periodStart: string;
  periodEnd: string;
  /** Fração do mês já passada (só no mês corrente). */
  progress: number;
  pool: { gross: number; fees: number; feePct: number; deductFees: boolean; barbersPart: number; carried: number; services: number; ticket: number; ownerPct: number };
  prevPending: { monthKey: string; mes: string; avulso: number; assinatura: number } | null;
  history: { month: string; total: number; barbers: number; paidAt: string }[];
}
type CommType = "PERCENTAGE" | "FIXED";
type View = "tudo" | "avulsos" | "assinaturas";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const brl = (v: number) => formatCurrency(v);
const brl0 = (v: number) => formatCurrency(v).replace(",00", "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dm = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const firstName = (n: string) => n.trim().split(/\s+/)[0];
const todayDm = () => new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

/** Quanto o profissional tem a receber na visão escolhida. */
const toReceive = (b: Barber, v: View = "tudo") =>
  v === "avulsos" ? b.liquidoAPagar : v === "assinaturas" ? b.liquidoAssinatura : b.liquidoAPagar + b.liquidoAssinatura;
/** Quanto ainda falta pagar na visão escolhida. */
const pending = (b: Barber, v: View = "tudo") =>
  v === "avulsos" ? b.saldoAvulso : v === "assinaturas" ? b.saldoAssinatura : b.saldoAvulso + b.saldoAssinatura;
function rule(b: Barber) {
  const s = b.commissionType === "FIXED" ? `${brl0(b.commission)} por serviço` : `${b.commission}% do avulso`;
  const p = b.productCommissionType === "FIXED" ? `${brl0(b.productCommission)} por produto` : `${b.productCommission}% produtos`;
  return `${s} · ${p}`;
}

export default function ComissoesPage() {
  const { token } = useAuthStore();
  const [offset, setOffset] = useState(0);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [rangeDraft, setRangeDraft] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<View>("tudo");
  const [valeFor, setValeFor] = useState<string | "pick" | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; run: () => Promise<void> } | null>(null);

  const load = useCallback(async () => {
    const url = range ? `/api/barbershop/comissoes?from=${range.from}&to=${range.to}` : `/api/barbershop/comissoes?month=${offset}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setData(await r.json());
  }, [token, offset, range]);

  useEffect(() => { load(); }, [load]);

  const call = useCallback(async (url: string, method: string, body: unknown, ok: string) => {
    const r = await fetch(url, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    if (r.ok) toast.success(ok); else toast.error((await r.json().catch(() => ({}))).error ?? "Não foi possível salvar.");
    load();
  }, [token, load]);

  const totals = useMemo(() => {
    const b = data?.barbers ?? [];
    const sum = (f: (x: Barber) => number) => b.reduce((s, x) => s + f(x), 0);
    const vales = b.flatMap((x) => x.vales.map((v) => ({ ...v, barberName: x.name })));
    return {
      atendimentos: sum((x) => x.avulso.atendimentos),
      faturado: sum((x) => x.avulso.faturado),
      comissaoAvulso: sum((x) => x.avulso.comissao),
      servicos: sum((x) => x.assinatura.servicos),
      comissaoAssinatura: sum((x) => x.assinatura.comissao),
      comissaoProprio: sum((x) => x.assinatura.comissaoProprio),
      produtos: sum((x) => x.produtos.comissao),
      gorjetas: sum((x) => x.gorjetas.total),
      vales: sum((x) => x.totalVales),
      receber: sum((x) => toReceive(x, view)),
      saldoAvulso: sum((x) => x.saldoAvulso),
      saldoAssinatura: sum((x) => x.saldoAssinatura),
      valesList: vales.map((v) => ({ ...v, createdAt: String(v.createdAt) })).sort((x, y) => y.createdAt.localeCompare(x.createdAt)),
    };
  }, [data, view]);

  function pay(b: Barber, type: PayType) {
    const amount = type === "STANDARD" ? b.saldoAvulso : b.saldoAssinatura;
    if (!data || amount <= 0) return;
    const what = type === "STANDARD" ? "avulsos, produtos e gorjetas" : `assinaturas de ${data.mes.split(" de ")[0]}`;
    setConfirm({
      title: `Pagar ${firstName(b.name)}?`,
      message: `${brl(amount)} de ${what}. Fica registrado como pago hoje${type === "STANDARD" && data.isCurrent ? "; o que ele fizer depois entra no próximo pagamento" : ""}.`,
      label: "Marcar como pago",
      run: () => call("/api/barbershop/comissoes/pagar", "POST", {
        barberId: b.id, month: data.monthKey, amount, type,
        notes: type === "STANDARD" ? (data.isCurrent ? `Avulsos até ${todayDm()}` : `Avulsos de ${data.mes}`) : `Assinaturas de ${data.mes}`,
      }, `Pagamento de ${firstName(b.name)} registrado`),
    });
  }

  function exportCsv() {
    if (!data) return;
    const cell = (v: number) => v.toFixed(2).replace(".", ",");
    const lines = [
      "Profissional;Atendimentos avulsos;Faturou;Comissão avulso;Serviços de plano;Comissão assinatura;Produtos;Gorjetas;Vales;A receber;Falta pagar",
      ...data.barbers.map((b) => [
        b.name, b.avulso.atendimentos, cell(b.avulso.faturado), cell(b.avulso.comissao), b.assinatura.servicos, cell(b.assinatura.comissao),
        cell(b.produtos.comissao), cell(b.gorjetas.total), cell(b.totalVales), cell(toReceive(b)), cell(pending(b)),
      ].join(";")),
    ];
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `comissoes_${data.monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const monthName = data ? data.mes.split(" de ")[0] : "";
  const monthEndLabel = data?.isCurrent ? dm(data.periodEnd) : null;
  const showAvulso = view !== "assinaturas";
  const showSub = view !== "avulsos";
  const cols = 1 + (showAvulso ? 3 : 0) + (showSub ? 2 : 0) + (showAvulso ? 3 : 0) + 2;

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Comissões</h1>
          <span className="text-sm text-ink-3">
            {!data ? " " : data.isRange ? `Período de ${data.mes} · só para consulta`
              : data.isCurrent ? `${cap(monthName)} está aberto · fecha em ${monthEndLabel}`
              : `${cap(data.mes)} · fechado`}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {range ? (
            <div className="flex items-center gap-1.5 h-[42px] px-2.5 rounded-[10px] border border-control bg-surface">
              <CalendarRange className="w-4 h-4 text-ink-3" aria-hidden />
              <input type="date" aria-label="De" value={rangeDraft?.from ?? range.from} onChange={(e) => setRangeDraft({ from: e.target.value, to: rangeDraft?.to ?? range.to })} className="bg-transparent text-sm outline-none" />
              <span className="text-ink-4">—</span>
              <input type="date" aria-label="Até" value={rangeDraft?.to ?? range.to} onChange={(e) => setRangeDraft({ from: rangeDraft?.from ?? range.from, to: e.target.value })} className="bg-transparent text-sm outline-none" />
              <button type="button" onClick={() => rangeDraft && setRange(rangeDraft)} className="h-8 px-2.5 rounded-lg bg-ink text-white text-xs font-semibold">Aplicar</button>
              <button type="button" onClick={() => { setRange(null); setRangeDraft(null); }} aria-label="Voltar para mês" className="w-8 h-8 rounded-lg hover:bg-surface-3 flex items-center justify-center"><X className="w-4 h-4" aria-hidden /></button>
            </div>
          ) : (
            <>
              <div className="flex items-center h-[42px] rounded-[10px] border border-control bg-surface">
                <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Mês anterior" className="w-10 h-full flex items-center justify-center hover:bg-surface-3 rounded-l-[10px]"><ChevronLeft className="w-4 h-4" aria-hidden /></button>
                <span className="px-2 text-sm font-semibold min-w-[150px] text-center">{data ? cap(data.mes) : "…"}</span>
                <button type="button" onClick={() => setOffset(Math.max(0, offset - 1))} disabled={offset === 0} aria-label="Próximo mês" className="w-10 h-full flex items-center justify-center hover:bg-surface-3 rounded-r-[10px] disabled:opacity-30"><ChevronRight className="w-4 h-4" aria-hidden /></button>
              </div>
              <button type="button" title="Período personalizado (só consulta)" aria-label="Período personalizado"
                onClick={() => {
                  const d = new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date());
                  const r = { from: d.slice(0, 8) + "01", to: d };
                  setRange(r); setRangeDraft(r);
                }}
                className="w-[42px] h-[42px] rounded-[10px] border border-control bg-surface flex items-center justify-center hover:bg-surface-3">
                <CalendarRange className="w-4 h-4" aria-hidden />
              </button>
            </>
          )}
          <button type="button" onClick={exportCsv} className="hidden md:inline-flex h-[42px] px-3.5 rounded-[10px] border border-control bg-surface text-sm font-semibold items-center gap-2 hover:bg-surface-3">
            <Download className="w-4 h-4" aria-hidden /> Exportar
          </button>
          {!range && (
            <button type="button" onClick={() => setValeFor("pick")} className="h-[42px] px-4 rounded-[10px] bg-primary text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary/90">
              <Plus className="w-4 h-4" aria-hidden /> Lançar vale
            </button>
          )}
        </div>
      </header>

      {!data ? (
        <div className="flex flex-col gap-5 animate-pulse" aria-busy>
          <div className="h-40 rounded-2xl bg-surface-2" /><div className="h-72 rounded-2xl bg-surface-2" />
        </div>
      ) : (
        <>
          {data.isRange && (
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
              Período personalizado é só para consulta: o pote usa o que foi pago nesses dias. Pagamentos e vales são lançados no mês.
            </p>
          )}
          {data.prevPending && (
            <div className="rounded-xl border border-warning/20 bg-warning-soft px-4 py-3 flex items-center gap-3 flex-wrap">
              <AlertCircle className="w-4 h-4 text-warning shrink-0" aria-hidden />
              <p className="text-[13px] flex-1 min-w-0">
                <span className="font-semibold">{cap(data.prevPending.mes)} ainda tem comissão a pagar:</span>{" "}
                {[data.prevPending.avulso > 0 && `${brl(data.prevPending.avulso)} de avulsos`, data.prevPending.assinatura > 0 && `${brl(data.prevPending.assinatura)} de assinaturas`].filter(Boolean).join(" e ")}.
              </p>
              <button type="button" onClick={() => setOffset(offset + 1)} className="h-8 px-3 rounded-lg border border-control bg-surface text-xs font-semibold hover:bg-surface-3">Ver {data.prevPending.mes}</button>
            </div>
          )}

          {/* As duas contas lado a lado */}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="rounded-2xl bg-surface border border-line p-4 flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Avulsos · pagos por semana</span>
              <Row label="Faturou" value={brl0(totals.faturado)} />
              <Row label="Comissão" value={brl(totals.comissaoAvulso)} strong />
              <Row label="Produtos e gorjetas" value={brl(totals.produtos + totals.gorjetas)} />
            </div>

            <div className="rounded-2xl bg-ink text-white p-4 flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-night-muted">Assinaturas · pote de {monthName}</span>
              <Row dark label="Mensalidades do mês" value={brl(data.pool.gross)} strong />
              {data.pool.fees > 0 && <Row dark label={`Taxa do cartão (${data.pool.feePct}%)`} value={`− ${brl(data.pool.fees)}`} />}
              <Row dark label={`${100 - data.pool.ownerPct}% para os barbeiros`} value={brl(data.pool.barbersPart - data.pool.carried)} />
              {data.pool.carried > 0 && <Row dark label="+ sobra de mês sem atendimento" value={brl(data.pool.carried)} />}
              <Row dark label="÷ serviços de plano feitos" value={String(data.pool.services)} />
              <div className="border-t border-night-line pt-2 mt-1 flex items-baseline justify-between gap-3">
                <span className="text-sm">Valor por serviço</span>
                <span className="font-display text-[26px] font-bold">{brl(data.pool.ticket)}</span>
              </div>
              {!data.isRange && (
                <span className={cn("self-start h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center", data.closed ? "bg-positive-soft text-positive" : "bg-white/10 text-white")}>
                  {data.closed ? "Mês fechado · pode pagar" : `Parcial · fecha em ${monthEndLabel ?? dm(data.periodEnd)}`}
                </span>
              )}
              {totals.comissaoProprio > 0 && (
                <span className="text-xs text-night-text">Planos com comissão própria ficam fora do pote: {brl(totals.comissaoProprio)} à parte.</span>
              )}
            </div>

            <div className="rounded-2xl bg-surface border border-line p-4 flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">{data.isRange ? "A receber no período" : "A pagar"}</span>
              <span className="font-display text-[28px] font-bold leading-tight">
                {brl0(data.isRange ? totals.receber : totals.saldoAvulso + totals.saldoAssinatura)}
              </span>
              {!data.isRange && (
                <>
                  <Row label="Avulsos, produtos e gorjetas" value={brl(totals.saldoAvulso)} />
                  <Row label={data.closed ? "Assinaturas" : "Assinaturas (após fechar)"} value={brl(totals.saldoAssinatura)} />
                  {totals.vales > 0 && <Row label="Vales já descontados" value={`− ${brl(totals.vales)}`} danger />}
                </>
              )}
            </div>
          </div>

          {/* Por profissional */}
          <section className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-3 border-b border-line-2 flex-wrap">
              <div className="flex rounded-[10px] bg-surface-2 p-1 text-sm font-semibold" role="tablist" aria-label="Mostrar">
                {([["tudo", "Tudo"], ["avulsos", "Avulsos"], ["assinaturas", "Assinaturas"]] as const).map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
                    className={cn("h-8 px-3.5 rounded-lg", view === k ? "bg-surface shadow-sm text-ink" : "text-ink-3 hover:text-ink")}>{l}</button>
                ))}
              </div>
              <span className="text-xs text-ink-3 hidden sm:inline">Toque numa linha para ver os atendimentos e pagar</span>
            </div>
            {data.barbers.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-ink-3">Nenhum profissional ativo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.06em] text-ink-3">
                      <th />
                      {showAvulso && <th colSpan={3} className="text-right font-semibold px-3 pt-2.5">Avulso</th>}
                      {showSub && <th colSpan={2} className="text-right font-semibold px-3 pt-2.5 bg-primary/5">Assinatura</th>}
                      {showAvulso && <th colSpan={3} className="text-right font-semibold px-3 pt-2.5">Extras</th>}
                      <th colSpan={2} />
                    </tr>
                    <tr className="text-xs text-ink-3 border-b border-line-2">
                      <th scope="col" className="text-left font-semibold px-5 py-2.5">Profissional</th>
                      {showAvulso && ["Atendim.", "Faturou", "Comissão"].map((h) => <th key={h} scope="col" className="text-right font-semibold px-3 py-2.5">{h}</th>)}
                      {showSub && ["Serviços", "Comissão"].map((h) => <th key={h} scope="col" className="text-right font-semibold px-3 py-2.5 bg-primary/5">{h}</th>)}
                      {showAvulso && ["Produtos", "Gorjetas", "Vales"].map((h) => <th key={h} scope="col" className="text-right font-semibold px-3 py-2.5">{h}</th>)}
                      <th scope="col" className="text-right font-semibold px-3 py-2.5">A receber</th>
                      <th scope="col" className="px-3"><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-3">
                    {data.barbers.map((b) => {
                      const isOpen = open === b.id;
                      const total = toReceive(b, view);
                      const due = pending(b, view);
                      return (
                        <Fragment key={b.id}>
                          <tr className={cn("cursor-pointer", isOpen ? "bg-surface-3/60" : "hover:bg-surface-3/40")} onClick={() => setOpen(isOpen ? null : b.id)}>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-full bg-surface-2 text-ink-2 text-xs font-bold flex items-center justify-center shrink-0">{getInitials(b.name)}</div>
                                <div className="min-w-0">
                                  <p className="font-semibold flex items-center gap-1.5">
                                    {b.name}
                                    <ChevronDown className={cn("w-3.5 h-3.5 text-ink-4 transition-transform", isOpen && "rotate-180")} aria-hidden />
                                  </p>
                                  <p className="text-xs text-ink-3">{rule(b)}</p>
                                </div>
                              </div>
                            </td>
                            {showAvulso && (
                              <>
                                <td className="px-3 text-right">{b.avulso.atendimentos}</td>
                                <td className="px-3 text-right">{brl0(b.avulso.faturado)}</td>
                                <td className="px-3 text-right font-semibold">{brl(b.avulso.comissao)}</td>
                              </>
                            )}
                            {showSub && (
                              <>
                                <td className="px-3 text-right bg-primary/5">{b.assinatura.servicos}</td>
                                <td className="px-3 text-right font-semibold bg-primary/5">{brl(b.assinatura.comissao)}</td>
                              </>
                            )}
                            {showAvulso && (
                              <>
                                <td className={cn("px-3 text-right", !b.produtos.comissao && "text-ink-4")}>{b.produtos.comissao ? brl(b.produtos.comissao) : "—"}</td>
                                <td className={cn("px-3 text-right", !b.gorjetas.total && "text-ink-4")}>{b.gorjetas.total ? brl(b.gorjetas.total) : "—"}</td>
                                <td className={cn("px-3 text-right", b.totalVales > 0 ? "text-danger-strong" : "text-ink-4")}>{b.totalVales > 0 ? `− ${brl(b.totalVales)}` : "—"}</td>
                              </>
                            )}
                            <td className="px-3 text-right">
                              <p className="font-bold">{brl(total)}</p>
                              {!data.isRange && total > 0 && (
                                <p className={cn("text-[11px] font-semibold", due > 0 ? "text-warning" : "text-positive")}>
                                  {due <= 0 ? "pago" : due < total - 0.01 ? `falta ${brl(due)}` : "a pagar"}
                                </p>
                              )}
                            </td>
                            <td className="px-3 pr-5" onClick={(e) => e.stopPropagation()}>
                              {!data.isRange && (
                                <div className="flex justify-end">
                                  <button type="button" onClick={() => setValeFor(b.id)} className="h-8 px-2.5 rounded-lg border border-control text-xs font-semibold hover:bg-surface-3" aria-label={`Lançar vale para ${b.name}`}>Vale</button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={cols} className="px-5 pb-5 pt-1 bg-surface-3/60">
                                <Detalhe b={b} data={data} offset={offset} view={view} onPay={(type) => pay(b, type)}
                                  onUnpay={(p) => setConfirm({
                                    title: "Desfazer pagamento?", message: `O pagamento de ${brl(p.amount)} feito a ${firstName(b.name)} em ${dm(String(p.paidAt))} é apagado e o valor volta para "a pagar".`,
                                    label: "Desfazer", run: () => call("/api/barbershop/comissoes/pagar", "DELETE", { id: p.id }, "Pagamento desfeito"),
                                  })}
                                  onSaveRule={(form) => call("/api/barbershop/comissoes", "PATCH", { barberId: b.id, ...form }, "Regra de comissão salva")} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    <tr className="bg-surface-3/40 font-semibold">
                      <td className="px-5 py-3">Total</td>
                      {showAvulso && (
                        <>
                          <td className="px-3 text-right">{totals.atendimentos}</td>
                          <td className="px-3 text-right">{brl0(totals.faturado)}</td>
                          <td className="px-3 text-right">{brl(totals.comissaoAvulso)}</td>
                        </>
                      )}
                      {showSub && (
                        <>
                          <td className="px-3 text-right bg-primary/5">{totals.servicos}</td>
                          <td className="px-3 text-right bg-primary/5">{brl(totals.comissaoAssinatura)}</td>
                        </>
                      )}
                      {showAvulso && (
                        <>
                          <td className="px-3 text-right">{brl(totals.produtos)}</td>
                          <td className="px-3 text-right">{brl(totals.gorjetas)}</td>
                          <td className="px-3 text-right text-danger-strong">{totals.vales > 0 ? `− ${brl(totals.vales)}` : "—"}</td>
                        </>
                      )}
                      <td className="px-3 text-right">{brl(totals.receber)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid lg:grid-cols-2 gap-5 items-start">
            {/* Vales */}
            <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-2">
              <div>
                <h2 className="text-[15px] font-semibold">Vales de {monthName}</h2>
                <p className="text-[13px] text-ink-3">descontados do pagamento de avulsos</p>
              </div>
              {totals.valesList.length === 0 ? (
                <p className="text-[13px] text-ink-3">Nenhum vale neste período.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line-3">
                  {totals.valesList.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 py-2 text-[13px]">
                      <span className="w-11 text-ink-3 shrink-0">{dm(v.createdAt)}</span>
                      <span className="flex-1 min-w-0 truncate"><span className="font-semibold">{v.barberName}</span>{v.description && <span className="text-ink-3"> · {v.description}</span>}</span>
                      <span className="font-semibold text-danger-strong shrink-0">− {brl(v.amount)}</span>
                      {!data.isRange && (
                        <button type="button" aria-label="Apagar vale" onClick={() => setConfirm({
                          title: "Apagar vale?", message: `${brl(v.amount)} de ${v.barberName} deixa de ser descontado.`, label: "Apagar",
                          run: () => call("/api/barbershop/comissoes/vale", "DELETE", { id: v.id }, "Vale apagado"),
                        })} className="w-8 h-8 rounded-lg text-ink-4 hover:bg-surface-3 hover:text-danger flex items-center justify-center shrink-0">
                          <Trash2 className="w-4 h-4" aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Meses anteriores */}
            <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-2">
              <h2 className="text-[15px] font-semibold">Meses anteriores</h2>
              {data.history.length === 0 ? (
                <p className="text-[13px] text-ink-3">Nenhum pagamento registrado antes deste mês.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line-3">
                  {data.history.map((h) => {
                    const [y, m] = h.month.split("-").map(Number);
                    return (
                      <li key={h.month} className="flex items-center gap-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{cap(MONTHS[m - 1])} de {y}</p>
                          <p className="text-xs text-ink-3">último pagamento em {dm(h.paidAt)} · {h.barbers} {h.barbers === 1 ? "profissional" : "profissionais"}</p>
                        </div>
                        <span className="text-sm font-semibold">{brl0(h.total)} pagos</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {valeFor && data && (
        <ValeModal barbers={data.barbers} initial={valeFor === "pick" ? null : valeFor} mes={data.mes}
          onClose={() => setValeFor(null)}
          onSave={async (barberId, amount, description) => {
            setValeFor(null);
            await call("/api/barbershop/comissoes/vale", "POST", { barberId, month: data.monthKey, amount, description }, "Vale lançado");
          }} />
      )}
      <ConfirmDialog isOpen={!!confirm} type="info" title={confirm?.title ?? ""} message={confirm?.message ?? ""} confirmLabel={confirm?.label}
        onConfirm={async () => { const c = confirm; setConfirm(null); if (c) await c.run(); }} onCancel={() => setConfirm(null)} />
    </div>
  );
}

function Row({ label, value, strong, dark, danger }: { label: string; value: string; strong?: boolean; dark?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className={dark ? "text-night-text" : "text-ink-2"}>{label}</span>
      <span className={cn("whitespace-nowrap shrink-0", strong && "font-bold", danger && "text-danger-strong")}>{value}</span>
    </div>
  );
}

type Pagamento = Barber["pagamentos"][number];

/* ─── Linha aberta: atendimentos, os dois pagamentos, regra ─── */
function Detalhe({ b, data, offset, view, onPay, onUnpay, onSaveRule }: {
  b: Barber; data: Data; offset: number; view: View;
  onPay: (type: PayType) => void;
  onUnpay: (p: Pagamento) => void;
  onSaveRule: (form: { commissionType: CommType; commission: number; productCommissionType: CommType; productCommission: number }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    commissionType: b.commissionType as CommType, commission: String(b.commission),
    productCommissionType: b.productCommissionType as CommType, productCommission: String(b.productCommission),
  });
  const items = [
    ...(view !== "assinaturas" ? b.avulso.items.map((i) => ({ ...i, kind: "avulso" as const })) : []),
    ...(view !== "avulsos" ? b.assinatura.items.map((i) => ({ ...i, kind: "plano" as const })) : []),
  ].sort((x, y) => y.date.localeCompare(x.date));
  const monthName = data.mes.split(" de ")[0];

  const payments = (type: PayType) => b.pagamentos.filter((p) => p.type === type);
  const paymentList = (type: PayType) => payments(type).map((p) => (
    <div key={p.id} className="flex items-center justify-between gap-3 py-1 text-[13px]">
      <span className="text-positive font-semibold">pago {brl(p.amount)} em {dm(String(p.paidAt))}</span>
      <span className="flex items-center gap-2 text-xs">
        <Link href={`/painel/comissoes/recibo?barberId=${b.id}&monthOffset=${offset}&type=${type}&paymentId=${p.id}`} target="_blank"
          className="inline-flex items-center gap-1 text-ink-3 underline underline-offset-2"><Printer className="w-3 h-3" aria-hidden />recibo</Link>
        <button type="button" onClick={() => onUnpay(p)} className="text-ink-3 underline underline-offset-2 hover:text-danger">desfazer</button>
      </span>
    </div>
  ));

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
      <div className="rounded-xl bg-surface border border-line-2 p-3.5 flex flex-col gap-2 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Atendimentos ({items.length})</p>
        {items.length === 0 ? <p className="text-[13px] text-ink-3">Nenhum atendimento no período.</p> : (
          <ul className="max-h-72 overflow-y-auto divide-y divide-line-3 text-[13px]">
            {items.map((i, idx) => (
              <li key={idx} className="flex items-center gap-3 py-1.5">
                <span className="w-11 text-ink-3 shrink-0">{new Date(i.date).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" })}</span>
                <span className="flex-1 min-w-0 truncate">{i.clientName} · {i.serviceName}</span>
                {i.kind === "plano"
                  ? <span className="text-xs font-semibold text-primary shrink-0">plano</span>
                  : <span className="font-semibold shrink-0">{brl(i.price)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {view !== "assinaturas" && (
          <div className="rounded-xl bg-surface border border-line-2 p-3.5 flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Avulsos · pagos por semana</p>
            <Row label="Comissão dos avulsos" value={brl(b.avulso.comissao)} />
            {b.produtos.comissao > 0 && <Row label="Produtos" value={brl(b.produtos.comissao)} />}
            {b.gorjetas.total > 0 && <Row label="Gorjetas" value={brl(b.gorjetas.total)} />}
            {b.totalVales > 0 && <Row label="Vales" value={`− ${brl(b.totalVales)}`} danger />}
            <div className="border-t border-line-3 pt-1.5"><Row label={data.isCurrent ? "Total do mês até hoje" : "Total do mês"} value={brl(b.liquidoAPagar)} strong /></div>
            {paymentList("STANDARD")}
            {!data.isRange && (
              <>
                {payments("STANDARD").length > 0 && <Row label="Falta pagar" value={brl(b.saldoAvulso)} strong />}
                <Button className="mt-1" variant={b.saldoAvulso > 0 ? "primary" : "outline"} disabled={b.saldoAvulso <= 0} onClick={() => onPay("STANDARD")}>
                  {b.saldoAvulso > 0 ? `Pagar avulsos · ${brl(b.saldoAvulso)}` : "Avulsos em dia"}
                </Button>
              </>
            )}
          </div>
        )}

        {view !== "avulsos" && (b.assinatura.servicos > 0 || payments("SUBSCRIPTION").length > 0) && (
          <div className="rounded-xl bg-surface border border-line-2 p-3.5 flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Assinaturas · pagas no fechamento</p>
            {b.assinatura.servicosPote > 0 && <Row label={`${b.assinatura.servicosPote} serviços × ${brl(data.pool.ticket)}`} value={brl(b.assinatura.comissaoPote)} />}
            {b.assinatura.servicosProprio > 0 && <Row label={`${b.assinatura.servicosProprio} em plano com comissão própria`} value={brl(b.assinatura.comissaoProprio)} />}
            <div className="border-t border-line-3 pt-1.5"><Row label={data.closed ? "Total do mês" : "Parcial até hoje"} value={brl(b.liquidoAssinatura)} strong /></div>
            {paymentList("SUBSCRIPTION")}
            {!data.isRange && (data.closed ? (
              <Button className="mt-1" variant={b.saldoAssinatura > 0 ? "primary" : "outline"} disabled={b.saldoAssinatura <= 0} onClick={() => onPay("SUBSCRIPTION")}>
                {b.saldoAssinatura > 0 ? `Pagar assinaturas · ${brl(b.saldoAssinatura)}` : "Assinaturas pagas"}
              </Button>
            ) : (
              <p className="text-xs text-ink-3 pt-1">O valor por serviço muda até o fim do mês. Libera para pagar quando {monthName} fechar, em {dm(data.periodEnd)}.</p>
            ))}
          </div>
        )}

        <div className="rounded-xl bg-surface border border-line-2 p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Regra de comissão</p>
            {!editing && <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-ink-2 underline underline-offset-2">Editar</button>}
          </div>
          {!editing ? (
            <p className="text-[13px]">{rule(b)}</p>
          ) : (
            <>
              {([["commissionType", "commission", "Serviços avulsos"], ["productCommissionType", "productCommission", "Produtos"]] as const).map(([tk, vk, label]) => (
                <div key={tk} className="flex items-center gap-2">
                  <span className="text-[13px] w-28 shrink-0">{label}</span>
                  <div className="flex rounded-lg border border-control overflow-hidden text-xs font-semibold">
                    {(["PERCENTAGE", "FIXED"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, [tk]: t }))}
                        className={cn("h-8 px-2.5", form[tk] === t ? "bg-ink text-white" : "bg-surface")}>{t === "PERCENTAGE" ? "%" : "R$"}</button>
                    ))}
                  </div>
                  <input value={form[vk]} onChange={(e) => setForm((f) => ({ ...f, [vk]: e.target.value }))} inputMode="decimal" aria-label={`${label} valor`}
                    className="w-20 h-8 rounded-lg border border-control px-2 text-sm outline-none focus:border-primary" />
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button size="sm" onClick={() => {
                  const c = parseMoney(form.commission), p = parseMoney(form.productCommission);
                  if ((form.commissionType === "PERCENTAGE" && c > 100) || (form.productCommissionType === "PERCENTAGE" && p > 100)) { toast.error("A porcentagem vai até 100%."); return; }
                  onSaveRule({ commissionType: form.commissionType, commission: c, productCommissionType: form.productCommissionType, productCommission: p });
                  setEditing(false);
                }}>Salvar</Button>
              </div>
              <p className="text-xs text-ink-3">Vale para o mês inteiro, inclusive o que já foi feito. Comissão fixa conta por serviço.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Lançar vale ─── */
function ValeModal({ barbers, initial, mes, onClose, onSave }: {
  barbers: Barber[]; initial: string | null; mes: string;
  onClose: () => void; onSave: (barberId: string, amount: number, description: string) => void;
}) {
  const [barberId, setBarberId] = useState(initial ?? barbers[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  return (
    <Modal open onClose={onClose} title="Lançar vale" description={`Adiantamento descontado do próximo pagamento de avulsos de ${mes}.`}>
      <div className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="vl-barber" className="block text-[13px] font-semibold text-ink-2 mb-1.5">Profissional</label>
          <select id="vl-barber" value={barberId} onChange={(e) => setBarberId(e.target.value)}
            className="w-full h-11 rounded-[10px] border border-control bg-surface px-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
            {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <Input label="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus />
        <Input label="Motivo (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: adiantamento, combustível" maxLength={80} />
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="lg" className="flex-[1.5]" disabled={!barberId || !(parseMoney(amount) > 0)} onClick={() => onSave(barberId, parseMoney(amount), description)}>Lançar vale</Button>
        </div>
      </div>
    </Modal>
  );
}
