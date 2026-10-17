"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Crown, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { todayKeySP } from "@/lib/subscriptionCycle";
import { SidePanel, Segmented, useWide } from "@/components/catalogo/SidePanel";
import { BaixaModal, NovoAssinanteModal } from "@/components/assinantes/Modals";
import { SubscriberPanel } from "@/components/assinantes/SubscriberPanel";
import { MONTHS_LONG, brl, dueText, methodText, priceText, stateOf, usage, whatsappCharge, type PlanOption, type Sub, type Tab } from "@/components/assinantes/types";

interface Stats {
  totalActive: number; mrr: number; newThisMonth: number;
  today: { count: number; paid: number; total: number };
  late: { count: number; total: number; oldestDays: number };
  cancelledMonth: { count: number; mrrLost: number; pct: number };
}
type Counts = Record<Tab, number>;

const PAGE = 30;
const EMPTY_COUNTS: Counts = { active: 0, today: 0, late: 0, paused: 0, cancelled: 0 };
const month = () => MONTHS_LONG[Number(todayKeySP().slice(5, 7)) - 1];

/** Assinantes. "barber": mesma tela, sem link de Planos e sem as ações que são só do dono. */
export default function AssinantesView({ mode = "owner" }: { mode?: "owner" | "barber" }) {
  const owner = mode === "owner";
  const { token } = useAuthStore();
  const wide = useWide();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<string | null>(searchParams.get("plano"));
  const [rows, setRows] = useState<Sub[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [stats, setStats] = useState<Stats | null>(null);
  const [today, setToday] = useState(todayKeySP());
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selected, setSelected] = useState<Sub | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [novo, setNovo] = useState(false);
  const [baixa, setBaixa] = useState<Sub[] | null>(null);
  const [moreLoading, setMoreLoading] = useState(false);

  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  const fetchPage = useCallback(async (skip: number) => {
    const params = new URLSearchParams({ status: tab, take: String(PAGE), skip: String(skip) });
    if (q) params.set("q", q);
    if (planFilter) params.set("planId", planFilter);
    return fetch(`/api/barbershop/subscriptions?${params}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  }, [tab, q, planFilter, token]);

  const load = useCallback(async () => {
    const d = await fetchPage(0);
    if (d.error) { toast.error(d.error); return; }
    setRows(d.subscriptions || []);
    setTotal(d.total ?? 0);
    setCounts(d.counts ?? EMPTY_COUNTS);
    setStats(d.stats ?? null);
    if (d.today) setToday(d.today);
    setChecked((c) => c.filter((id) => (d.subscriptions || []).some((s: Sub) => s.id === id)));
  }, [fetchPage]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/barbershop/plans", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then((d) => setPlans(d.plans || [])).catch(() => {});
  }, [token]);

  async function more() {
    setMoreLoading(true);
    const d = await fetchPage(rows?.length ?? 0);
    setMoreLoading(false);
    if (d.subscriptions) setRows((r) => [...(r ?? []), ...d.subscriptions]);
  }

  async function sendLink(s: Sub) {
    const r = await fetch(`/api/barbershop/subscriptions/${s.id}/send-authorization`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    if (r.ok) toast.success(d.message ?? "Link enviado no WhatsApp"); else toast.error(d.error ?? "Não foi possível enviar o link.");
  }

  const list = rows ?? [];
  const selectable = tab === "today" || tab === "late";
  const checkedSubs = useMemo(() => list.filter((s) => checked.includes(s.id)), [list, checked]);
  const allChecked = selectable && list.length > 0 && list.every((s) => checked.includes(s.id));
  const planName = planFilter ? plans.find((p) => p.id === planFilter)?.name : null;
  const changeTab = (t: Tab) => { setTab(t); setChecked([]); };

  function action(s: Sub) {
    const st = stateOf(s, today).state;
    const base = "h-[34px] px-3 rounded-[9px] text-xs font-semibold whitespace-nowrap inline-flex items-center justify-center";
    const dark = cn(base, "bg-ink text-white hover:bg-ink/90");
    const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
    if (st === "today") return <button type="button" className={dark} onClick={stop(() => setBaixa([s]))} aria-label={`Dar baixa · ${s.client.name}`}>Dar baixa</button>;
    if (st === "failed") return <button type="button" className={dark} onClick={stop(() => sendLink(s))} aria-label={`Enviar novo link · ${s.client.name}`}>Novo link</button>;
    if (st === "late") {
      const wa = whatsappCharge(s);
      return wa
        ? <a href={wa} target="_blank" rel="noreferrer" className={dark} onClick={(e) => e.stopPropagation()} aria-label={`Cobrar no WhatsApp · ${s.client.name}`}>Cobrar</a>
        : <button type="button" className={dark} onClick={stop(() => setBaixa([s]))}>Dar baixa</button>;
    }
    if (st === "auth") return <button type="button" className={cn(base, "border border-control bg-surface")} onClick={stop(() => sendLink(s))} aria-label={`Reenviar link · ${s.client.name}`}>Reenviar link</button>;
    return null;
  }

  const check = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const tabs: [Tab, string][] = [
    ["active", `Ativos · ${counts.active}`], ["today", `Cobrar hoje · ${counts.today}`], ["late", `Em atraso · ${counts.late}`],
    ["paused", `Pausados · ${counts.paused}`], ["cancelled", `Cancelados · ${counts.cancelled}`],
  ];

  return (
    <div className="flex flex-col gap-5 pb-20 md:pb-0">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Assinantes</h1>
          <span className="text-sm text-ink-3">Clube de assinatura da barbearia</span>
        </div>
        <div className="flex gap-2">
          {owner && <Link href="/painel/planos" className="hidden sm:inline-flex h-[42px] px-3.5 rounded-[10px] border border-control bg-surface text-sm font-semibold items-center hover:bg-surface-3">Planos</Link>}
          <button type="button" onClick={() => setNovo(true)} className="h-[42px] px-4 rounded-[10px] bg-primary text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary/90">
            <Plus className="w-4 h-4" aria-hidden /> Novo assinante
          </button>
        </div>
      </header>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="col-span-2 lg:col-span-1 rounded-[14px] bg-ink text-white px-[18px] py-4 flex flex-col gap-1.5">
          <span className="text-[13px] text-night-text">Recorrência</span>
          <span className="font-display text-[28px] font-bold leading-none">{stats ? brl(stats.mrr) : "—"}<span className="text-[15px] text-night-text">/mês</span></span>
          <span className="text-xs text-night-text">{stats ? `${stats.totalActive} ativos · +${stats.newThisMonth} novo${stats.newThisMonth === 1 ? "" : "s"} em ${month()}` : " "}</span>
        </div>
        <button type="button" onClick={() => changeTab("today")} className="text-left rounded-[14px] bg-surface border border-line px-[18px] py-4 flex flex-col gap-1.5 hover:border-control">
          <span className="text-[13px] text-ink-2">Cobranças de hoje</span>
          <span className="font-display text-[22px] md:text-[26px] font-bold leading-none">{stats ? brl(stats.today.total) : "—"}</span>
          <span className="text-xs text-ink-3">{stats ? (stats.today.count ? `${stats.today.count} cobrança${stats.today.count === 1 ? "" : "s"} · ${stats.today.paid} já paga${stats.today.paid === 1 ? "" : "s"}` : "nada vence hoje") : " "}</span>
        </button>
        <button type="button" onClick={() => changeTab("late")} className="text-left rounded-[14px] bg-surface border border-line px-[18px] py-4 flex flex-col gap-1.5 hover:border-control">
          <span className="text-[13px] text-ink-2">Em atraso</span>
          <span className={cn("font-display text-[22px] md:text-[26px] font-bold leading-none", stats?.late.count && "text-danger-strong")}>{stats ? brl(stats.late.total) : "—"}</span>
          <span className="text-xs text-ink-3">{stats ? (stats.late.count ? `${stats.late.count} assinante${stats.late.count === 1 ? "" : "s"}${stats.late.oldestDays ? ` · mais antigo há ${stats.late.oldestDays} dia${stats.late.oldestDays === 1 ? "" : "s"}` : ""}` : "ninguém devendo") : " "}</span>
        </button>
        <div className="hidden lg:flex rounded-[14px] bg-surface border border-line px-[18px] py-4 flex-col gap-1.5">
          <span className="text-[13px] text-ink-2">Cancelaram em {month()}</span>
          <span className="font-display text-[26px] font-bold leading-none">{stats ? stats.cancelledMonth.count : "—"}</span>
          <span className="text-xs text-ink-3">{stats ? (stats.cancelledMonth.count ? `${brl(stats.cancelledMonth.mrrLost)}/mês a menos · ${(stats.cancelledMonth.pct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da base` : "nenhum cancelamento") : " "}</span>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        <section aria-label="Lista de assinantes" className="flex-1 min-w-0 bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-line-2">
            <Segmented value={tab} onChange={changeTab} label="Situação" options={tabs} />
            <label className="flex items-center gap-2 h-10 px-3 rounded-[10px] border border-control bg-ground w-full sm:w-60">
              <Search className="w-4 h-4 text-ink-3 shrink-0" aria-hidden />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar assinante" aria-label="Buscar assinante" className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
            </label>
          </div>
          {planFilter && (
            <div className="px-4 py-2 border-b border-line-2 flex items-center gap-2 text-[13px]">
              <span className="text-ink-3">Plano:</span>
              <span className="h-7 pl-3 pr-1 rounded-full bg-surface-2 font-semibold inline-flex items-center gap-1">
                {planName ?? "…"}
                <button type="button" onClick={() => setPlanFilter(null)} aria-label="Tirar filtro de plano" className="w-6 h-6 rounded-full hover:bg-surface-3 inline-flex items-center justify-center"><X className="w-3.5 h-3.5" aria-hidden /></button>
              </span>
            </div>
          )}

          {/* Cabeçalho (computador) */}
          <div className={cn("hidden md:grid gap-3 px-4 py-2.5 text-xs font-semibold text-ink-3 border-b border-line-2", selectable ? "grid-cols-[24px_minmax(0,1.6fr)_minmax(0,1.1fr)_0.8fr_minmax(0,1fr)_118px]" : "grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_0.8fr_minmax(0,1fr)_118px]")}>
            {selectable && <input type="checkbox" checked={allChecked} onChange={() => setChecked(allChecked ? [] : list.map((s) => s.id))} aria-label="Selecionar todos" className="w-4 h-4 accent-ink self-center" />}
            <span>Assinante</span><span>Uso neste ciclo</span><span>Cobrança</span><span>Situação</span><span />
          </div>

          {!rows ? <div className="h-64 animate-pulse bg-surface-3/50" aria-busy /> : list.length === 0 ? (
            <div className="px-6 py-12 flex flex-col items-center gap-2 text-center">
              <Crown className="w-9 h-9 text-ink-4" aria-hidden />
              <p className="font-semibold">{q ? "Ninguém encontrado" : tab === "today" ? "Nada para cobrar hoje" : tab === "late" ? "Ninguém em atraso" : tab === "active" ? "Nenhum assinante ainda" : "Ninguém aqui"}</p>
              {tab === "active" && !q && <p className="text-[13px] text-ink-3">Cadastre o primeiro em “Novo assinante”.</p>}
            </div>
          ) : (
            <div className="divide-y divide-line-3">
              {list.map((s) => {
                const st = stateOf(s, today);
                const u = usage(s);
                const on = selected?.id === s.id;
                return (
                  <div key={s.id} role="button" tabIndex={0} onClick={() => setSelected(s)} onKeyDown={(e) => { if (e.key === "Enter") setSelected(s); }} aria-current={on || undefined}
                    className={cn("cursor-pointer outline-none focus-visible:bg-surface-3", on ? "bg-primary/[0.07]" : "hover:bg-surface-3/50")}>
                    {/* Computador */}
                    <div className={cn("hidden md:grid gap-3 items-center min-h-16 px-4 py-2", selectable ? "grid-cols-[24px_minmax(0,1.6fr)_minmax(0,1.1fr)_0.8fr_minmax(0,1fr)_118px]" : "grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_0.8fr_minmax(0,1fr)_118px]")}>
                      {selectable && <input type="checkbox" checked={checked.includes(s.id)} onClick={(e) => e.stopPropagation()} onChange={() => check(s.id)} aria-label={`Selecionar ${s.client.name}`} className="w-4 h-4 accent-ink" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{s.client.name}</p>
                        <p className="text-xs text-ink-3 truncate">{s.plan.name} · {priceText(s)}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <span className={cn("text-[13px] truncate", u.over ? "text-danger font-semibold" : u.full && "text-warning")}>{u.text}</span>
                        {u.pct > 0 && <div className="h-[5px] rounded-full bg-track"><div className={cn("h-full rounded-full", u.over ? "bg-danger-strong" : u.full ? "bg-[#B08A2E]" : "bg-ink")} style={{ width: `${u.pct}%` }} /></div>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold">{dueText(s, today)}</p>
                        <p className="text-xs text-ink-3 truncate">{methodText(s)}</p>
                      </div>
                      <span className={cn("justify-self-start h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center whitespace-nowrap", st.cls)}>{st.text}</span>
                      <div className="justify-self-end">{action(s)}</div>
                    </div>
                    {/* Celular */}
                    <div className="md:hidden flex flex-col gap-2 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {selectable && <input type="checkbox" checked={checked.includes(s.id)} onClick={(e) => e.stopPropagation()} onChange={() => check(s.id)} aria-label={`Selecionar ${s.client.name}`} className="w-5 h-5 mt-0.5 accent-ink shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold truncate">{s.client.name}</p>
                            <p className="text-xs text-ink-3 truncate">{s.plan.name} · {priceText(s)}</p>
                          </div>
                        </div>
                        <span className={cn("h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center whitespace-nowrap shrink-0", st.cls)}>{st.text}</span>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                          <span className="text-[13px] text-ink-2 truncate">{u.text} · cobra {dueText(s, today).toLowerCase()}</span>
                          {u.pct > 0 && <div className="h-[5px] rounded-full bg-track"><div className={cn("h-full rounded-full", u.over ? "bg-danger-strong" : u.full ? "bg-[#B08A2E]" : "bg-ink")} style={{ width: `${u.pct}%` }} /></div>}
                        </div>
                        {action(s)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {rows && list.length < total && (
            <button type="button" onClick={more} disabled={moreLoading} className="w-full h-12 border-t border-line-2 text-[13px] font-semibold text-ink-2 hover:bg-surface-3 disabled:opacity-60">
              {moreLoading ? "Carregando…" : `Mostrar mais (${total - list.length})`}
            </button>
          )}
        </section>

        <SidePanel open={!!selected} wide={wide} onClose={() => setSelected(null)} label="Assinante">
          {selected && <SubscriberPanel key={selected.id} sub={selected} today={today} plans={plans} onChanged={load} onClose={() => setSelected(null)} canManage={owner} />}
        </SidePanel>
      </div>

      {checkedSubs.length > 0 && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-ink text-white pl-4 pr-2 py-2 rounded-2xl shadow-2xl">
          <span className="text-sm font-semibold whitespace-nowrap">{checkedSubs.length} selecionado{checkedSubs.length === 1 ? "" : "s"} · {brl(checkedSubs.reduce((s, x) => s + x.plan.price, 0))}</span>
          <button type="button" onClick={() => setBaixa(checkedSubs)} className="h-10 px-4 rounded-xl bg-primary text-sm font-semibold whitespace-nowrap">Dar baixa</button>
          <button type="button" onClick={() => setChecked([])} aria-label="Limpar seleção" className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center"><X className="w-4 h-4" aria-hidden /></button>
        </div>
      )}

      {novo && <NovoAssinanteModal plans={plans} onClose={() => setNovo(false)} onDone={() => { setNovo(false); load(); }} />}
      {baixa && <BaixaModal subs={baixa} onClose={() => setBaixa(null)} onDone={() => { setBaixa(null); setChecked([]); load(); }} />}
    </div>
  );
}
