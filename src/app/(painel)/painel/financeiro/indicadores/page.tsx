"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { comebackMessage, waLink } from "@/components/clientes/types";

type Period = "thisMonth" | "last7" | "last30" | "lastMonth";
type Tab = "subs" | "services" | "clients" | "forecast";

interface Data {
  period: { key: Period; start: string; end: string };
  subscriptions: {
    mrr: number; active: number; overdue: number; paused: number; payingRate: number; newSubs: number; prevNewSubs: number;
    plans: { name: string; price: number; subs: number; total: number }[];
    billing: { id: string; amount: number; status: string; date: string; method: string; clientName: string; planName: string }[];
    billingProblems: number;
  };
  pool: {
    gross: number; fees: number; feePct: number; deductFees: boolean; net: number; ownerPct: number; shopPart: number;
    barbersPart: number; services: number; ticket: number;
    share: { id: string; name: string; services: number; poolServices: number; poolValue: number; ownServices: number; ownValue: number; value: number }[];
  };
  services: {
    count: number; avulsos: number; daysOpen: number; revenue: number; fees: number; net: number; debitFee: number; creditFee: number;
    avgTicket: number; ranking: { name: string; count: number; revenue: number }[];
    barbers: { id: string; name: string; count: number; gross: number; commission: number }[];
  };
  clients: {
    registered: number; served: number; newClients: number; returned: number;
    top: { name: string; phone: string | null; visits: number; spent: number }[];
    lapsedDays: number; lapsedCount: number; lapsed: { id: string; name: string; phone: string | null; lastVisit: string; days: number }[];
  };
}
interface Forecast {
  breakdown: { monthlyMRR: number; activeSubscriptions: number; avgMonthlyServices: number; monthlyFixedExpenses: number; avgMonthlyVarExpenses: number; avgMonthlyExpenses: number; historicalMonths: number };
  periods: { days: number; label: string; mrrPortion: number; servicesPortion: number; revenue: number; expenses: number; net: number }[];
}

const PERIODS: [Period, string][] = [["thisMonth", "Este mês"], ["last7", "Últimos 7 dias"], ["last30", "Últimos 30 dias"], ["lastMonth", "Mês passado"]];
const brl = (v: number) => formatCurrency(v);
const brl0 = (v: number) => formatCurrency(Math.round(v)).replace(",00", "");
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const dmy = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short" }).replace(".", "");
function periodLabel(d: Data) {
  const s = new Date(d.period.start), e = new Date(d.period.end);
  const f = (x: Date) => x.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long" });
  return `${f(s)} a ${f(e)}`;
}

function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "danger" | "positive" }) {
  return (
    <div className="rounded-2xl bg-surface border border-line p-4 flex flex-col gap-1 min-w-0">
      <span className="text-[13px] text-ink-3">{label}</span>
      <span className={cn("font-display text-2xl font-bold", tone === "danger" && "text-danger-strong", tone === "positive" && "text-positive")}>{value}</span>
      {sub && <span className="text-xs text-ink-3">{sub}</span>}
    </div>
  );
}

export default function IndicadoresPage() {
  const { token } = useAuthStore();
  const [period, setPeriod] = useState<Period>("thisMonth");
  const [tab, setTab] = useState<Tab>("subs");
  const [data, setData] = useState<Data | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/barbershop/financeiro/indicadores?period=${period}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setData(await r.json());
  }, [period, token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab !== "forecast" || forecast) return;
    fetch("/api/barbershop/financeiro/forecast", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null)).then((d) => d && setForecast(d)).catch(() => {});
  }, [tab, forecast, token]);

  const tabs: [Tab, string, string][] = [
    ["subs", "Assinaturas e receita", data ? String(data.subscriptions.active) : "–"],
    ["services", "Atendimentos e serviços", data ? String(data.services.count) : "–"],
    ["clients", "Clientes", data ? String(data.clients.served) : "–"],
    ["forecast", "Previsão", "90 dias"],
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Indicadores</h1>
          <span className="text-sm text-ink-3">Os números para decidir o próximo passo{data && tab !== "forecast" ? ` · ${periodLabel(data)}` : ""}</span>
        </div>
        {tab !== "forecast" && (
          <div role="group" aria-label="Período" className="flex p-1 rounded-[10px] bg-surface-3 overflow-x-auto max-w-full">
            {PERIODS.map(([k, l]) => (
              <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)}
                className={cn("h-8 px-3 rounded-lg text-[13px] font-semibold whitespace-nowrap", period === k ? "bg-surface text-ink shadow-sm" : "text-ink-2")}>
                {l}
              </button>
            ))}
          </div>
        )}
      </header>

      <div role="tablist" aria-label="Indicadores" className="flex gap-1 border-b border-line overflow-x-auto">
        {tabs.map(([k, l, c]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("h-11 px-3 -mb-px border-b-2 text-sm font-semibold whitespace-nowrap inline-flex items-center gap-2",
              tab === k ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
            {l}
            <span className={cn("h-5 px-1.5 rounded-full text-[11px] inline-flex items-center", tab === k ? "bg-ink text-white" : "bg-track text-ink-2")}>{c}</span>
          </button>
        ))}
      </div>

      {tab === "forecast" ? (
        <ForecastTab f={forecast} />
      ) : !data ? (
        <div className="flex flex-col gap-4 animate-pulse" aria-busy><div className="h-28 rounded-2xl bg-surface-2" /><div className="h-72 rounded-2xl bg-surface-2" /></div>
      ) : tab === "subs" ? (
        <SubsTab d={data} onSaved={load} />
      ) : tab === "services" ? (
        <ServicesTab d={data} />
      ) : (
        <ClientsTab d={data} />
      )}
    </div>
  );
}

/* ─── Assinaturas e receita ─── */
function SubsTab({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const s = d.subscriptions;
  const diff = s.newSubs - s.prevNewSubs;
  const [page, setPage] = useState(0);
  const rows = s.billing.slice(page * 7, page * 7 + 7);
  const maxPlan = Math.max(1, ...s.plans.map((p) => p.subs));
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Receita fixa das assinaturas" value={<>{brl0(s.mrr)} <span className="text-sm font-normal text-ink-3">/mês</span></>} sub="entra todo mês, antes de qualquer corte" />
        <Kpi label="Novas assinaturas" value={`+${s.newSubs}`} sub={diff === 0 ? "igual ao período anterior" : `${Math.abs(diff)} a ${diff > 0 ? "mais" : "menos"} que no período anterior`} />
        <div className="rounded-2xl bg-surface border border-line p-4 flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-3">Pagando em dia</span>
          <span className={cn("font-display text-2xl font-bold", s.payingRate < 85 && "text-danger-strong")}>{s.payingRate}%</span>
          <div className="h-1.5 rounded-full bg-track overflow-hidden" aria-hidden><div className="h-full bg-positive" style={{ width: `${s.payingRate}%` }} /></div>
          <span className="text-xs text-ink-3">{s.active} de {s.active + s.overdue}{s.overdue ? ` · ${s.overdue} em atraso` : ""}</span>
        </div>
        <Kpi label="Assinantes" value={s.active + s.overdue + s.paused} sub={[`${s.active} em dia`, s.overdue && `${s.overdue} em atraso`, s.paused && `${s.paused} pausados`].filter(Boolean).join(" · ")} />
      </div>

      <Pote d={d} onSaved={onSaved} />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-5 items-start">
        <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">Assinantes por plano</h2>
            <Link href="/painel/planos" className="text-[13px] font-semibold text-ink-2 underline-offset-2 hover:underline">Editar planos</Link>
          </div>
          {s.plans.length === 0 ? <p className="text-[13px] text-ink-3">Nenhum assinante ativo.</p> : (
            <ul className="flex flex-col gap-3">
              {s.plans.map((p) => (
                <li key={p.name} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span><span className="font-semibold">{p.name}</span> <span className="text-ink-3">· {p.subs} {p.subs === 1 ? "assinante" : "assinantes"}</span></span>
                    <span className="font-semibold">{brl0(p.total)}/mês</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-track overflow-hidden" aria-hidden><div className="h-full bg-ink-2" style={{ width: `${(p.subs / maxPlan) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3 border-b border-line-2">
            <div>
              <h2 className="text-[15px] font-semibold">Cobranças recentes</h2>
              <p className="text-[13px] text-ink-3">{s.billing.length} no período{s.billingProblems ? ` · ${s.billingProblems} com problema` : ""}</p>
            </div>
            <Link href="/painel/assinaturas" className="text-[13px] font-semibold text-ink-2 underline-offset-2 hover:underline">Ver assinantes</Link>
          </div>
          {s.billing.length === 0 ? <p className="px-5 py-6 text-[13px] text-ink-3">Nenhuma cobrança no período.</p> : (
            <>
              <ul className="divide-y divide-line-3">
                {rows.map((b) => {
                  const st = b.status === "PAID" ? ["Pago", "bg-positive-soft text-positive"] : b.status === "FAILED" ? ["Recusada", "bg-danger-soft text-danger"] : b.status === "REFUNDED" ? ["Estornada", "bg-surface-3 text-ink-2"] : ["Aguardando", "bg-warning-soft text-warning"];
                  return (
                    <li key={b.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_90px_70px_96px] gap-3 items-center px-5 py-2.5 text-[13px]">
                      <div className="min-w-0"><p className="font-semibold truncate">{b.clientName}</p><p className="text-xs text-ink-3 truncate">{b.method}</p></div>
                      <span className="hidden sm:block truncate text-ink-2">{b.planName}</span>
                      <span className="font-semibold text-right">{brl(b.amount)}</span>
                      <span className="hidden sm:block text-ink-3">{dmy(b.date)}</span>
                      <span className={cn("h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center justify-self-end", st[1])}>{st[0]}</span>
                    </li>
                  );
                })}
              </ul>
              {s.billing.length > 7 && (
                <div className="flex items-center justify-between px-5 py-2.5 border-t border-line-2 text-[13px] text-ink-2">
                  <span>Mostrando {page * 7 + 1}–{Math.min(s.billing.length, page * 7 + 7)} de {s.billing.length}</span>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
                    <Button size="sm" variant="outline" disabled={(page + 1) * 7 >= s.billing.length} onClick={() => setPage(page + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ─── Pote das assinaturas ─── */
function Pote({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const { token } = useAuthStore();
  const p = d.pool;
  const [editing, setEditing] = useState(false);
  const [ownerPct, setOwnerPct] = useState(p.ownerPct);
  const [deduct, setDeduct] = useState(p.deductFees);
  const [fee, setFee] = useState(String(p.feePct || ""));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const r = await fetch("/api/barbershop/financeiro/poe-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ poeOwnerPct: ownerPct, poeDeductFees: deduct, ...(deduct ? { poeSubscriptionFee: Number(fee.replace(",", ".")) || 0 } : {}) }),
    });
    setSaving(false);
    if (!r.ok) { toast.error("Não foi possível salvar a divisão."); return; }
    toast.success("Divisão salva. As comissões de assinatura já usam a nova conta.");
    setEditing(false);
    onSaved();
  }

  const gross = p.gross || 1;
  const bar = [
    { label: "Taxa do cartão", sub: p.deductFees ? `${pct(p.feePct)} descontado antes de dividir` : "não descontada", v: p.fees, color: "bg-bar-soft", show: p.deductFees },
    { label: `Fica com a barbearia · ${p.ownerPct}%`, sub: "entra no caixa", v: p.shopPart, color: "bg-ink", show: true },
    { label: `Pote dos profissionais · ${100 - p.ownerPct}%`, sub: "dividido por atendimento de assinante", v: p.barbersPart, color: "bg-primary", show: true },
  ].filter((x) => x.show);
  const maxShare = Math.max(1, ...p.share.map((s) => s.services));
  const ownTotal = p.share.reduce((s, x) => s + x.ownValue, 0);
  const ownServices = p.share.reduce((s, x) => s + x.ownServices, 0);
  const poolPaid = p.share.reduce((s, x) => s + x.poolValue, 0);

  return (
    <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="max-w-xl">
          <h2 className="text-[15px] font-semibold">Pote das assinaturas</h2>
          <p className="text-[13px] text-ink-3">Como o dinheiro das assinaturas é dividido entre a barbearia e os profissionais que atenderam os assinantes</p>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="h-9 px-3 rounded-[9px] border border-control text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-surface-3">
            <Settings2 className="w-4 h-4" aria-hidden /> Ajustar divisão
          </button>
        )}
      </div>

      {editing && (
        <div className="rounded-xl border border-line bg-surface-3/50 p-4 flex flex-col gap-3">
          <div>
            <span className="block text-[13px] font-semibold text-ink-2 mb-1.5">Parte que fica com a barbearia</span>
            <div role="radiogroup" aria-label="Parte da barbearia" className="flex p-1 rounded-[10px] bg-surface-3 w-fit">
              {[40, 50, 60, 70].map((v) => (
                <button key={v} type="button" role="radio" aria-checked={ownerPct === v} onClick={() => setOwnerPct(v)}
                  className={cn("h-8 px-3.5 rounded-lg text-[13px] font-semibold", ownerPct === v ? "bg-surface shadow-sm" : "text-ink-2")}>{v}%</button>
              ))}
            </div>
            <p className="text-xs text-ink-3 mt-1.5">O resto vai para o pote dos profissionais: {100 - ownerPct}%</p>
          </div>
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} className="w-4 h-4 accent-[var(--color-primary)]" />
            Descontar taxa do cartão antes de dividir
          </label>
          {deduct && (
            <label className="flex items-center gap-2 text-sm">
              Taxa
              <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" aria-label="Taxa em %" className="w-20 h-9 rounded-lg border border-control px-2 outline-none focus:border-primary" />
              %
            </label>
          )}
          <p className="text-xs text-warning bg-warning-soft rounded-lg px-3 py-2">Muda o valor que os profissionais recebem pelas assinaturas, a partir das comissões deste mês.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setOwnerPct(p.ownerPct); setDeduct(p.deductFees); }}>Cancelar</Button>
            <Button size="sm" loading={saving} onClick={save}>Salvar divisão</Button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[13px] text-ink-3">Arrecadado com assinaturas no período{ownServices > 0 ? " (sem os planos com comissão própria)" : ""}</p>
            <p className="font-display text-[28px] font-bold leading-tight">{brl(p.gross)}</p>
          </div>
          <div className="h-3 rounded-full bg-track overflow-hidden flex" aria-hidden>
            {bar.map((b) => <div key={b.label} className={b.color} style={{ width: `${(b.v / gross) * 100}%` }} />)}
          </div>
          <ul className="flex flex-col gap-2">
            {bar.map((b) => (
              <li key={b.label} className="flex items-center gap-2.5 text-[13px]">
                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", b.color)} aria-hidden />
                <span className="flex-1 min-w-0"><span className="font-semibold">{b.label}</span> <span className="text-ink-3">· {b.sub}</span></span>
                <span className="font-semibold">{b.label.startsWith("Taxa") ? "− " : ""}{brl(b.v)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3 rounded-xl bg-surface-3/60 px-3.5 py-2.5">
            <div>
              <p className="text-[13px] font-semibold">Cada atendimento de assinante vale</p>
              <p className="text-xs text-ink-3">pote dos profissionais ÷ {p.services} {p.services === 1 ? "atendimento" : "atendimentos"}</p>
            </div>
            <span className="font-display text-xl font-bold">{brl(p.ticket)}</span>
          </div>
          {p.share.length === 0 ? <p className="text-[13px] text-ink-3">Nenhum atendimento de assinante no período.</p> : (
            <ul className="flex flex-col gap-2.5">
              {p.share.map((s) => (
                <li key={s.id} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-surface-2 text-ink-2 text-[11px] font-bold flex items-center justify-center shrink-0">{getInitials(s.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2 text-[13px]">
                      <span className="font-semibold truncate">{s.name}</span><span className="font-semibold shrink-0">{brl(s.value)}</span>
                    </div>
                    <div className="flex justify-between gap-2 text-xs text-ink-3">
                      <span>{s.poolServices} × {brl(p.ticket)}{s.ownServices > 0 && ` + ${s.ownServices} em plano com comissão própria (${brl(s.ownValue)})`}</span><span>{pct(p.services ? (s.services / p.services) * 100 : 0)} do pote</span>
                    </div>
                    <div className="h-1 rounded-full bg-track overflow-hidden mt-1" aria-hidden><div className="h-full bg-primary" style={{ width: `${(s.services / maxShare) * 100}%` }} /></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/painel/comissoes" className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-[13px] hover:bg-surface-3">
            <span className="font-semibold">Vai para as comissões</span><span className="font-bold">{brl(poolPaid + ownTotal)}</span>
          </Link>
          {ownServices > 0 && (
            <p className="text-xs text-warning bg-warning-soft rounded-lg px-3 py-2">
              {ownServices} {ownServices === 1 ? "serviço foi" : "serviços foram"} de plano com comissão própria: pagos pela % do plano ({brl(ownTotal)}). Esses planos ficam fora do pote — nem o dinheiro nem os atendimentos deles entram na divisão.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── Atendimentos e serviços ─── */
function ServicesTab({ d }: { d: Data }) {
  const s = d.services;
  const maxRank = Math.max(1, ...s.ranking.map((r) => r.count));
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Atendimentos" value={s.count} sub={s.daysOpen ? `concluídos · média de ${Math.round(s.count / s.daysOpen)} por dia aberto` : "concluídos"} />
        <Kpi label="Faturou em serviços" value={brl0(s.revenue)} sub="avulsos e extras de assinantes" />
        <Kpi label="Depois das taxas da maquininha" value={brl0(s.net)} sub={`− ${brl(s.fees)} · débito ${s.debitFee}% e crédito ${s.creditFee}%`} />
        <Kpi label="Ticket médio" value={brl0(s.avgTicket)} sub="por atendimento avulso" />
      </div>
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between"><h2 className="text-[15px] font-semibold">Serviços mais feitos</h2><span className="text-xs text-ink-3">vezes · faturamento</span></div>
          {s.ranking.length === 0 ? <p className="text-[13px] text-ink-3">Nenhum atendimento no período.</p> : (
            <ol className="flex flex-col gap-2.5">
              {s.ranking.map((r, i) => (
                <li key={r.name} className="flex items-center gap-3">
                  <span className="w-5 text-[13px] font-bold text-ink-3">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2 text-[13px]"><span className="font-semibold truncate">{r.name}</span><span className="shrink-0"><span className="font-semibold">{r.count}</span> <span className="text-ink-3">· {brl0(r.revenue)}</span></span></div>
                    <div className="h-1.5 rounded-full bg-track overflow-hidden mt-1" aria-hidden><div className="h-full bg-ink-2" style={{ width: `${(r.count / maxRank) * 100}%` }} /></div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-ink-3">Corte + Barba conta nos dois. Atendimento de assinante entra nas vezes, mas não no faturamento (o plano já foi pago).</p>
        </section>
        <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">Quanto cada profissional produziu</h2>
            <Link href="/painel/comissoes" className="text-[13px] font-semibold text-ink-2 underline-offset-2 hover:underline">Ver comissões</Link>
          </div>
          <ul className="flex flex-col divide-y divide-line-3">
            {s.barbers.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-2.5">
                <div className="w-9 h-9 rounded-full bg-surface-2 text-ink-2 text-xs font-bold flex items-center justify-center shrink-0">{getInitials(b.name)}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{b.name}</p><p className="text-xs text-ink-3">{b.count} atendimentos · comissão {brl0(b.commission)}</p></div>
                <span className="text-sm font-bold">{brl0(b.gross)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ─── Clientes ─── */
function ClientsTab({ d }: { d: Data }) {
  const c = d.clients;
  const retPct = c.served ? (c.returned / c.served) * 100 : 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <div className="rounded-2xl bg-surface border border-line p-4 flex flex-col gap-2">
          <div className="flex items-baseline justify-between"><span className="text-[13px] text-ink-3">Clientes atendidos · de {c.registered.toLocaleString("pt-BR")} cadastrados</span></div>
          <span className="font-display text-[28px] font-bold leading-none">{c.served}</span>
          <div className="h-2 rounded-full bg-track overflow-hidden flex" aria-hidden>
            <div className="bg-ink" style={{ width: `${retPct}%` }} /><div className="bg-primary" style={{ width: `${100 - retPct}%` }} />
          </div>
          <div className="flex gap-4 text-xs text-ink-3">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-ink" aria-hidden />{c.returned} voltaram</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" aria-hidden />{c.newClients} vieram pela primeira vez</span>
          </div>
        </div>
        <Kpi label="Clientes que voltaram" value={c.returned} sub="já tinham vindo antes deste período" />
        <Kpi label="Clientes novos" value={`+${c.newClients}`} sub="primeira visita registrada" tone="positive" />
      </div>
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
          <div><h2 className="text-[15px] font-semibold">Clientes que mais gastaram</h2><p className="text-[13px] text-ink-3">no período escolhido</p></div>
          {c.top.length === 0 ? <p className="text-[13px] text-ink-3">Nenhum atendimento no período.</p> : (
            <ol className="flex flex-col divide-y divide-line-3">
              {c.top.map((t, i) => (
                <li key={t.name + i} className="flex items-center gap-3 py-2">
                  <span className="w-5 text-[13px] font-bold text-ink-3">{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{t.name}</p><p className="text-xs text-ink-3">{t.visits} {t.visits === 1 ? "visita" : "visitas"}</p></div>
                  <span className="text-sm font-bold">{brl0(t.spent)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-[15px] font-semibold">Sumidos há mais de {c.lapsedDays} dias</h2><p className="text-[13px] text-ink-3">Mande um convite para voltar</p></div>
            <span className="text-sm font-bold shrink-0">{c.lapsedCount} {c.lapsedCount === 1 ? "cliente" : "clientes"}</span>
          </div>
          {c.lapsed.length === 0 ? <p className="text-[13px] text-ink-3">Ninguém sumido. 👏</p> : (
            <ul className="flex flex-col divide-y divide-line-3">
              {c.lapsed.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{l.name}</p><p className="text-xs text-ink-3">última visita {dmy(l.lastVisit)}</p></div>
                  <span className="text-[13px] font-semibold text-[#9A4A13] shrink-0">{l.days} dias</span>
                  {l.phone ? (
                    <a href={waLink(l.phone, comebackMessage({ name: l.name }))} target="_blank" rel="noreferrer"
                      className="h-8 px-2.5 rounded-lg border border-control text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-surface-3 shrink-0">
                      <MessageCircle className="w-3.5 h-3.5" aria-hidden /> Chamar
                    </a>
                  ) : <span className="text-xs text-ink-4 shrink-0 w-[70px] text-center">sem WhatsApp</span>}
                </li>
              ))}
            </ul>
          )}
          {c.lapsedCount > 0 && <Link href="/painel/clientes" className="text-[13px] font-semibold text-ink-2 underline-offset-2 hover:underline">Ver todos em Clientes</Link>}
        </section>
      </div>
    </div>
  );
}

/* ─── Previsão ─── */
function ForecastTab({ f }: { f: Forecast | null }) {
  if (!f) return <div className="h-72 rounded-2xl bg-surface-2 animate-pulse" aria-busy />;
  const b = f.breakdown;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-ink-2 bg-surface-3 rounded-xl px-4 py-3">
        Conta feita com as <strong>assinaturas ativas</strong> + a <strong>média de serviços dos últimos {b.historicalMonths} {b.historicalMonths === 1 ? "mês" : "meses"}</strong>, menos as <strong>despesas fixas e variáveis</strong>. É uma estimativa, não uma promessa.
      </p>
      <div className="grid md:grid-cols-3 gap-3">
        {f.periods.map((p) => (
          <section key={p.days} className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold">Próximos {p.label}</h2>
            <div><p className="text-[13px] text-ink-3">Deve entrar</p><p className="font-display text-2xl font-bold">{brl0(p.revenue)}</p></div>
            <div className="flex flex-col text-[13px] divide-y divide-line-3">
              <div className="flex justify-between py-1.5"><span className="text-ink-3">Assinaturas</span><span>{brl0(p.mrrPortion)}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-ink-3">Serviços avulsos</span><span>{brl0(p.servicesPortion)}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-ink-3">Despesas estimadas</span><span>− {brl0(p.expenses)}</span></div>
            </div>
            <div className="flex justify-between items-baseline rounded-xl bg-surface-3/60 px-3 py-2">
              <span className="text-[13px] font-semibold">Deve sobrar</span>
              <span className={cn("font-display text-xl font-bold", p.net < 0 && "text-danger-strong")}>{brl0(p.net)}</span>
            </div>
          </section>
        ))}
      </div>
      <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">De onde vêm esses números</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["Assinaturas por mês", brl0(b.monthlyMRR), `${b.activeSubscriptions} assinaturas ativas`],
            ["Serviços por mês", brl0(b.avgMonthlyServices), `média dos últimos ${b.historicalMonths} meses`],
            ["Despesas fixas", brl0(b.monthlyFixedExpenses), "recorrentes deste mês"],
            ["Despesas variáveis", brl0(b.avgMonthlyVarExpenses), "média dos últimos 3 meses"],
          ].map(([l, v, s]) => (
            <div key={l} className="rounded-xl border border-line-2 p-3.5"><p className="text-[13px] text-ink-3">{l}</p><p className="text-lg font-bold">{v}</p><p className="text-xs text-ink-3">{s}</p></div>
          ))}
        </div>
      </section>
    </div>
  );
}
