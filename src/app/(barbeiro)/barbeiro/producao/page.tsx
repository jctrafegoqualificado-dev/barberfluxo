"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import { Segmented } from "@/components/catalogo/SidePanel";

interface Item { id: string; date: string; time?: string; client: string | null; label: string; valor: number; comissao: number; gorjeta?: number; plano?: string; proprio?: boolean; qty?: number }
interface Ganhos {
  month: string; isCurrent: boolean; today: string;
  rates: { commissionType: string; commission: number; productCommissionType: string; productCommission: number };
  summary: {
    total: number; servicos: number; produtos: number; gorjetas: number; vales: number; aReceber: number; assinatura: number;
    avulsoFaturado: number; produtosVendidos: number; assinaturaServicos: number; ticketPote: number;
    paid: { paidAt: string; amount: number } | null; subPaid: { paidAt: string; amount: number } | null;
    valesList: { id: string; amount: number; description: string | null; createdAt: string }[];
    avulso: number; avulsoAtendimentos: number; assinaturaProprio: number;
  };
  payout: {
    closed: boolean;
    avulso: { devido: number; falta: number };
    assinatura: { devido: number; falta: number };
    pagamentos: { id: string; type: "STANDARD" | "SUBSCRIPTION"; amount: number; paidAt: string; notes: string | null }[];
  };
  forecast: number | null; previousSamePeriod: number | null;
  kpis: { atendimentos: number; ticketMedio: number; comparecimento: number | null; noShow: number; avulsos: number; assinantes: number };
  days: { date: string; value: number }[];
  best: { date: string; value: number } | null;
  services: { name: string; count: number; revenue: number }[];
  items: { avulso: Item[]; assinatura: Item[]; produtos: Item[] };
}
type Tab = "avulso" | "assinatura" | "produtos";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const brl = (v: number) => formatCurrency(v);
const short = (v: number) => formatCurrency(v).replace(",00", "");
const addMonth = (m: string, d: number) => { const [y, mm] = m.split("-").map(Number); const x = new Date(Date.UTC(y, mm - 1 + d, 1)); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`; };
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]} de ${m.slice(0, 4)}`;
const ddmm = (k: string) => `${k.slice(8)}/${k.slice(5, 7)}`;
const rate = (type: string, v: number) => (type === "FIXED" ? `${short(v)} fixo` : `${v}%`);

/** Acerto do mês como na tela Comissões do dono: avulsos pagos por semana e assinaturas no fechamento. */
function Pagamentos({ d, mName }: { d: Ganhos; mName: string }) {
  const { payout } = d;
  const nextName = MONTHS[Number(addMonth(d.month, 1).slice(5)) - 1];
  const parts = [
    {
      key: "STANDARD", title: "Avulsos, produtos e gorjetas", note: "pagos por semana",
      devidoLabel: d.summary.vales > 0 ? "Comissão do mês (já sem os vales)" : "Comissão do mês",
      devido: payout.avulso.devido, falta: payout.avulso.falta,
      faltaLabel: "Falta receber",
    },
    {
      key: "SUBSCRIPTION", title: "Assinaturas", note: "pagas depois que o mês fecha",
      devidoLabel: payout.closed ? "Comissão do mês" : "Comissão do mês (parcial)",
      devido: payout.assinatura.devido, falta: payout.assinatura.falta,
      faltaLabel: payout.closed ? "Falta receber" : `A receber depois de ${mName}`,
    },
  ].filter((p) => p.key === "STANDARD" || p.devido > 0 || payout.pagamentos.some((x) => x.type === "SUBSCRIPTION"));

  return (
    <section aria-label="Pagamentos" className="rounded-2xl bg-surface border border-line p-4 md:p-5 flex flex-col gap-4">
      <span className="text-[15px] font-semibold">Pagamentos de {mName}</span>
      <div className={cn("grid gap-4", parts.length > 1 && "md:grid-cols-2")}>
        {parts.map((p) => {
          const pays = payout.pagamentos.filter((x) => x.type === p.key);
          return (
            <div key={p.key} className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3 pb-1.5">{p.title} · {p.note}</span>
              <div className="flex justify-between gap-3 min-h-[40px] items-center border-b border-line-3 text-sm">
                <span className="text-ink-2">{p.devidoLabel}</span><span className="font-semibold">{brl(p.devido)}</span>
              </div>
              {pays.length === 0 ? (
                <p className="min-h-[40px] flex items-center border-b border-line-3 text-[13px] text-ink-3">
                  {p.key === "SUBSCRIPTION" && !payout.closed ? `O dono paga em ${nextName}, depois que o mês fecha.` : "Nenhum pagamento ainda."}
                </p>
              ) : pays.map((x) => (
                <div key={x.id} className="flex justify-between gap-3 min-h-[40px] items-center border-b border-line-3 text-sm">
                  <span className="min-w-0 truncate"><span className="text-positive-strong font-semibold">✓</span> Pago em {ddmm(x.paidAt.slice(0, 10))}{x.notes ? <span className="text-ink-3"> · {x.notes}</span> : null}</span>
                  <span className="shrink-0">{brl(x.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between gap-3 min-h-[44px] items-center text-sm">
                <span className="font-semibold">{p.falta <= 0 && pays.length ? "Tudo pago" : p.faltaLabel}</span>
                <span className="font-display text-lg font-bold">{brl(p.falta)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function GanhosPage() {
  const { token } = useAuthStore();
  const [month, setMonth] = useState<string | null>(null);
  const [d, setD] = useState<Ganhos | null>(null);
  const [tab, setTab] = useState<Tab>("avulso");
  const [shown, setShown] = useState(15);

  const load = useCallback(async () => {
    setD(null);
    const r = await fetch(`/api/barber/ganhos${month ? `?month=${month}` : ""}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json().catch(() => null);
    if (r.ok && data) { setD(data); if (!month) setMonth(data.month); }
  }, [month, token]);
  useEffect(() => { load(); }, [load]);

  const m = d?.month ?? month;
  const s = d?.summary;
  const mName = m ? MONTHS[Number(m.slice(5)) - 1] : "";
  const prevName = m ? MONTHS[Number(addMonth(m, -1).slice(5)) - 1] : "";
  const delta = d && d.previousSamePeriod ? (s!.total - d.previousSamePeriod) / d.previousSamePeriod : null;
  const maxDay = Math.max(1, ...(d?.days.map((x) => x.value) ?? [1]));
  const maxSvc = Math.max(1, ...(d?.services.map((x) => x.count) ?? [1]));
  const items = d ? d.items[tab] : [];

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Seus ganhos</h1>
          <span className="text-sm text-ink-3">Os mesmos números que o dono vê nas Comissões</span>
        </div>
        {m && (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setMonth(addMonth(m, -1))} aria-label="Mês anterior" className="w-10 h-10 rounded-[10px] border border-control bg-surface inline-flex items-center justify-center hover:bg-surface-3"><ChevronLeft className="w-4 h-4" aria-hidden /></button>
            <span className="min-w-[150px] text-center text-[15px] font-semibold first-letter:uppercase">{monthLabel(m)}</span>
            <button type="button" onClick={() => setMonth(addMonth(m, 1))} disabled={d?.isCurrent ?? true} aria-label="Próximo mês" className="w-10 h-10 rounded-[10px] border border-control bg-surface inline-flex items-center justify-center hover:bg-surface-3 disabled:opacity-40"><ChevronRight className="w-4 h-4" aria-hidden /></button>
          </div>
        )}
      </header>

      {!d || !s ? <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"><div className="h-80 rounded-2xl bg-surface-3/60 animate-pulse" /><div className="h-80 rounded-2xl bg-surface-3/60 animate-pulse" /></div> : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start">
            {/* Comissão do mês */}
            <section aria-label="Comissão do mês" className="rounded-2xl bg-ink text-white p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[13px] text-night-text">{d.isCurrent ? "Sua comissão até hoje" : `Sua comissão em ${mName}`}</span>
                <span className="font-display text-[38px] font-bold leading-none tracking-[-0.02em]">{short(s.total)}</span>
                {d.isCurrent && (
                  <span className="text-[13px] text-night-text">
                    {delta != null && <>{delta >= 0 ? "↑" : "↓"} {Math.abs(Math.round(delta * 100))}% vs {prevName} no mesmo período · </>}
                    previsão do mês <strong className="text-white">{short(d.forecast ?? s.total)}</strong>
                  </span>
                )}
              </div>
              <div className="flex flex-col border-t border-night-line">
                {[
                  ["bg-white", "Avulsos", `${rate(d.rates.commissionType, d.rates.commission)} · ${s.avulsoAtendimentos} atendimento${s.avulsoAtendimentos === 1 ? "" : "s"} · faturou ${short(s.avulsoFaturado)}`, short(s.avulso)],
                  ...(s.assinaturaServicos > 0 || s.assinatura > 0 ? [["bg-night-muted", "Assinaturas", `${s.assinaturaServicos} serviço${s.assinaturaServicos === 1 ? "" : "s"} de plano${s.ticketPote && !s.assinaturaProprio ? ` × ${brl(s.ticketPote)}` : ""}${d.payout.closed ? "" : " · parcial até o mês fechar"}`, short(s.assinatura)]] : []),
                  ["bg-primary", "Produtos", `${s.produtosVendidos} vendido${s.produtosVendidos === 1 ? "" : "s"}`, short(s.produtos)],
                  ["bg-positive-strong", "Gorjetas", "100% suas", short(s.gorjetas)],
                  ...(s.vales > 0 ? [["bg-danger-strong", "Vales já retirados", `${s.valesList.length} vale${s.valesList.length === 1 ? "" : "s"}`, `− ${short(s.vales)}`]] : []),
                ].map(([dot, l, sub, v]) => (
                  <div key={l} className="flex items-center gap-2.5 min-h-[44px] border-b border-night-line">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", dot)} />
                    <span className="flex-1 min-w-0 text-sm truncate">{l} <span className="text-night-muted">· {sub}</span></span>
                    <span className="text-sm font-semibold shrink-0">{v}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  [String(d.kpis.atendimentos), "atendimentos"],
                  [short(d.kpis.ticketMedio), "ticket médio"],
                  [d.kpis.comparecimento == null ? "—" : `${Math.round(d.kpis.comparecimento * 100)}%`, d.kpis.noShow ? `compareceram · ${d.kpis.noShow} falta${d.kpis.noShow === 1 ? "" : "s"}` : "compareceram"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-2xl bg-surface border border-line p-3.5 flex flex-col gap-0.5 min-w-0">
                    <span className="font-display text-xl md:text-2xl font-bold truncate">{v}</span>
                    <span className="text-xs text-ink-3">{l}</span>
                  </div>
                ))}
              </div>

              <section aria-label="Atendimentos por tipo" className="rounded-2xl bg-surface border border-line p-4 flex flex-col gap-2.5">
                <span className="text-sm font-semibold">Avulsos e assinantes</span>
                <div className="flex h-2.5 gap-0.5 rounded-full overflow-hidden bg-track">
                  {d.kpis.avulsos > 0 && <div className="bg-ink" style={{ flex: d.kpis.avulsos }} />}
                  {d.kpis.assinantes > 0 && <div className="bg-primary" style={{ flex: d.kpis.assinantes }} />}
                </div>
                <div className="flex justify-between text-xs text-ink-2 gap-2 flex-wrap">
                  <span><strong className="text-ink">{d.kpis.avulsos}</strong> avulsos</span>
                  <span><strong className="text-ink">{d.kpis.assinantes}</strong> de assinantes · pelo pote{s.ticketPote ? ` (${brl(s.ticketPote)} por serviço)` : ""}</span>
                </div>
              </section>

              <section aria-label="Serviços mais feitos" className="rounded-2xl bg-surface border border-line p-4 flex flex-col gap-2.5">
                <span className="text-sm font-semibold">Serviços que você mais fez</span>
                {d.services.length === 0 ? <p className="text-[13px] text-ink-3">Nenhum atendimento concluído.</p> : d.services.map((x) => (
                  <div key={x.name} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[13px] gap-2"><span className="font-semibold truncate">{x.name}</span><span className="text-ink-3 shrink-0">{x.count}× {x.revenue ? `· ${short(x.revenue)}` : ""}</span></div>
                    <div className="h-1.5 rounded-full bg-track"><div className="h-full rounded-full bg-ink" style={{ width: `${(x.count / maxSvc) * 100}%` }} /></div>
                  </div>
                ))}
              </section>
            </div>
          </div>

          <Pagamentos d={d} mName={mName} />

          {/* Comissão por dia */}
          <section aria-label="Comissão por dia" className="rounded-2xl bg-surface border border-line p-4 md:p-5 flex flex-col gap-3">
            <div className="flex justify-between items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold">Comissão por dia</span>
              {d.best && <span className="text-xs text-ink-3">melhor dia: {WEEK[new Date(`${d.best.date}T12:00:00Z`).getUTCDay()]} {Number(d.best.date.slice(8))} · {short(d.best.value)}</span>}
            </div>
            <div className="flex items-end gap-[3px] h-[130px]" role="img" aria-label="Comissão por dia do mês">
              {d.days.map((x) => (
                <div key={x.date} title={`${ddmm(x.date)} · ${x.value ? brl(x.value) : "sem atendimento"}`}
                  className={cn("flex-1 rounded-t-[3px] min-w-0", x.date === d.today ? "bg-primary" : x.value ? "bg-bar" : "bg-track")}
                  style={{ height: x.value ? `${Math.max(4, (x.value / maxDay) * 100)}%` : "3px" }} />
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-ink-3">
              <span>1</span>
              {d.days.length > 10 && <span>{Math.round(d.days.length / 2)}</span>}
              <span className={cn(d.isCurrent && "text-primary font-semibold")}>{d.isCurrent ? "hoje" : d.days.length}</span>
            </div>
          </section>

          {/* Extrato */}
          <section aria-label="Extrato" className="rounded-2xl bg-surface border border-line overflow-hidden">
            <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-line-2">
              <span className="text-[15px] font-semibold">Extrato de {mName}</span>
              <Segmented value={tab} onChange={(v) => { setTab(v); setShown(15); }} label="Tipo"
                options={[["avulso", `Avulsos · ${d.items.avulso.length}`], ["assinatura", `Assinaturas · ${d.items.assinatura.length}`], ["produtos", `Produtos · ${d.items.produtos.length}`]]} />
            </div>
            {items.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-ink-3">Nada aqui neste mês.</p> : (
              <div className="divide-y divide-line-3">
                {items.slice(0, shown).map((x) => (
                  <div key={x.id} className="flex items-center gap-3 px-4 min-h-[60px] py-2">
                    <div className="w-12 shrink-0 flex flex-col">
                      <span className="text-[13px] font-semibold">{ddmm(x.date)}</span>
                      {x.time && <span className="text-[11px] text-ink-3">{x.time}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{tab === "produtos" ? x.label : x.client}</p>
                      <p className="text-xs text-ink-3 truncate">
                        {tab === "produtos" ? `${x.client ?? "venda avulsa"} · ${x.qty}×` : x.label}
                        {x.plano && <> · <span className="text-primary font-semibold">{x.plano}{x.proprio ? " (comissão própria)" : ""}</span></>}
                        {x.gorjeta ? <> · gorjeta {brl(x.gorjeta)}</> : null}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-ink-3">{brl(x.valor)}</p>
                      <p className="text-sm font-bold">+{brl(x.comissao + (x.gorjeta ?? 0))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {items.length > shown && (
              <button type="button" onClick={() => setShown((n) => n + 30)} className="w-full h-11 border-t border-line-2 text-[13px] font-semibold text-ink-2 hover:bg-surface-3">Mostrar mais ({items.length - shown})</button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
