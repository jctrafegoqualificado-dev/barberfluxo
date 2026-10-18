"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Clock, Crown, Lock, Pencil, Plus, Trash2, Users, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, getInitials } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Segmented, SidePanel, fieldCls, useWide } from "@/components/catalogo/SidePanel";

type Tipo = "ATENDIMENTOS" | "RECEITA" | "ASSINANTES" | "OCUPACAO";
type Periodo = "MONTHLY" | "WEEKLY";
type Status = "done" | "ahead" | "ok" | "slight" | "behind";
interface Meta {
  id: string; titulo: string; tipo: Tipo; periodo: Periodo; valorAlvo: number;
  barberId: string | null; barberName: string | null;
  atual: number; pct: number; expectedPct: number | null; status: Status; note: string; plan: string;
}
interface PeriodInfo { start: string; end: string; day: number; totalDays: number; openTotal: number; openRemaining: number }
interface Data { today: string; month: PeriodInfo; week: PeriodInfo; metas: Meta[]; updatedAt: string }
type Form = { mode: "new" } | { mode: "edit"; id: string };

const TIPOS: Record<Tipo, { label: string; hint: string; unit: string; icon: typeof Users; placeholder: string }> = {
  ATENDIMENTOS: { label: "Atendimentos", hint: "comandas fechadas", unit: "atendimentos", icon: Users, placeholder: "100" },
  RECEITA: { label: "Receita", hint: "valor dos serviços", unit: "R$", icon: Wallet, placeholder: "5000" },
  ASSINANTES: { label: "Assinantes", hint: "planos ativos", unit: "assinantes", icon: Crown, placeholder: "70" },
  OCUPACAO: { label: "Ocupação", hint: "% da agenda cheia", unit: "%", icon: Clock, placeholder: "70" },
};
const STATUS: Record<Status, [string, string]> = {
  done: ["Concluída", "bg-ink text-white"],
  ahead: ["À frente", "bg-positive-soft text-positive"],
  ok: ["No ritmo", "bg-positive-soft text-positive"],
  slight: ["Um pouco atrás", "bg-warning-soft text-warning"],
  behind: ["Atrás", "bg-danger-soft text-danger"],
};
const doneLabel = (n: number) => (n === 0 ? "nenhuma concluída" : n === 1 ? "1 concluída" : `${n} concluídas`);
const fmt = (t: Tipo, v: number) =>
  t === "RECEITA" ? "R$ " + Math.round(v).toLocaleString("pt-BR") : t === "OCUPACAO" ? `${Math.round(v)}%` : Math.round(v).toLocaleString("pt-BR");
const monthLabel = (k: string) => {
  const s = new Date(k + "T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  return s[0].toUpperCase() + s.slice(1);
};
const dm = (k: string) => new Date(k + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", timeZone: "UTC" }).replace("-feira", "");

function PeriodBar({ title, right, pct, foot }: { title: string; right: string; pct: number; foot: string }) {
  return (
    <div className="px-[22px] py-[18px] flex flex-col gap-2 min-w-0">
      <div className="flex justify-between items-baseline gap-3">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[13px] text-ink-3">{right}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-2"><div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} /></div>
      <span className="text-xs text-ink-3">{foot}</span>
    </div>
  );
}

export default function MetasPage() {
  const { token } = useAuthStore();
  const wide = useWide();
  const [d, setD] = useState<Data | null>(null);
  const [barbers, setBarbers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<"todas" | "mensais" | "semanais">("todas");
  const [form, setForm] = useState<Form | null>(null);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<Tipo>("ATENDIMENTOS");
  const [periodo, setPeriodo] = useState<Periodo>("MONTHLY");
  const [barberId, setBarberId] = useState("");
  const [valor, setValor] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const h = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const load = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([fetch("/api/barbershop/metas", { headers: h }), fetch("/api/barbershop/barbers", { headers: h })]);
      if (!r1.ok) throw new Error();
      setD(await r1.json());
      if (r2.ok) {
        const j = await r2.json();
        setBarbers((j.barbers ?? []).map((b: { id: string; nickname?: string | null; user: { name: string } }) => ({ id: b.id, name: b.nickname || b.user.name })));
      }
    } catch {
      setError(true);
    }
  }, [h]);
  useEffect(() => { load(); }, [load]);

  const editing = form?.mode === "edit" ? d?.metas.find((m) => m.id === form.id) ?? null : null;

  function openNew() {
    setForm({ mode: "new" }); setTitulo(""); setTipo("ATENDIMENTOS"); setPeriodo("MONTHLY"); setBarberId(""); setValor(""); setConfirmDel(false);
  }
  function openEdit(m: Meta) {
    setForm({ mode: "edit", id: m.id }); setTitulo(m.titulo); setValor(String(m.valorAlvo)); setConfirmDel(false);
  }

  async function save() {
    const alvo = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!titulo.trim()) return toast.error("Dê um nome para a meta");
    if (!(alvo > 0)) return toast.error("Informe um valor maior que zero");
    setBusy(true);
    try {
      const r = form?.mode === "edit"
        ? await fetch(`/api/barbershop/metas/${form.id}`, { method: "PUT", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ titulo, valorAlvo: alvo }) })
        : await fetch("/api/barbershop/metas", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ titulo, tipo, periodo, valorAlvo: alvo, barberId: tipo === "ASSINANTES" ? null : barberId || null }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Não foi possível salvar");
      toast.success(form?.mode === "edit" ? "Meta atualizada" : "Meta criada");
      setForm(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (form?.mode !== "edit") return;
    setBusy(true);
    try {
      const r = await fetch(`/api/barbershop/metas/${form.id}`, { method: "DELETE", headers: h });
      if (!r.ok) throw new Error();
      toast.success("Meta excluída");
      setForm(null);
      await load();
    } catch {
      toast.error("Não foi possível excluir");
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <header className="flex items-end justify-between gap-3 flex-wrap">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Metas</h1>
        <span className="text-sm text-ink-3">
          {d ? `${d.metas.length} ${d.metas.length === 1 ? "meta ativa" : "metas ativas"} · ${doneLabel(d.metas.filter((m) => m.status === "done").length)} · atualizado às ${new Date(d.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}` : "Carregando…"}
        </span>
      </div>
      <div className="flex items-center gap-2.5 flex-wrap">
        <Segmented value={filter} onChange={setFilter} label="Filtrar metas por período" options={[["todas", "Todas"], ["mensais", "Mensais"], ["semanais", "Semanais"]]} />
        <Button onClick={openNew} className="h-[42px]"><Plus className="w-4 h-4 mr-1.5" aria-hidden />Nova meta</Button>
      </div>
    </header>
  );

  if (error) return <div className="flex flex-col gap-5">{header}<p role="alert" className="rounded-2xl bg-danger-soft text-danger px-5 py-4 text-sm">Não foi possível carregar as metas. <button type="button" className="font-semibold underline" onClick={() => { setError(false); load(); }}>Tentar de novo</button></p></div>;
  if (!d) return <div className="flex flex-col gap-5">{header}<div className="h-28 rounded-2xl bg-surface border border-line animate-pulse" /><div className="h-80 rounded-2xl bg-surface border border-line animate-pulse" /></div>;

  const visible = d.metas.filter((m) => filter === "todas" || (filter === "mensais" ? m.periodo === "MONTHLY" : m.periodo === "WEEKLY"));
  const shop = visible.filter((m) => !m.barberId);
  const team = visible.filter((m) => m.barberId).sort((a, b) => (a.barberName ?? "").localeCompare(b.barberName ?? ""));
  const counts = (Object.keys(STATUS) as Status[]).map((k) => ({ k, n: d.metas.filter((m) => m.status === k).length }));
  const mPct = Math.round(((d.month.day - 0.5) / d.month.totalDays) * 100);
  const wPct = Math.round(((d.week.day - 0.5) / d.week.totalDays) * 100);
  const curTipo = editing?.tipo ?? tipo;
  const curPeriodo = editing?.periodo ?? periodo;

  const row = (m: Meta, showBarber: boolean, count: number) => {
    const Icon = TIPOS[m.tipo].icon;
    const [sLabel, sCls] = STATUS[m.status];
    const selected = form?.mode === "edit" && form.id === m.id;
    return (
      <div key={m.id} className={cn("border-t border-line-2", selected && "bg-primary/5")}>
        {showBarber && (
          <div className="flex items-center gap-2.5 px-5 pt-3.5">
            <span className="w-7 h-7 rounded-full bg-surface-2 text-ink-2 text-[11px] font-bold flex items-center justify-center">{getInitials(m.barberName ?? "")}</span>
            <span className="text-sm font-semibold">{m.barberName}</span>
            <span className="text-xs text-ink-3">{count === 1 ? "1 meta" : `${count} metas`}</span>
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-2.5 px-5 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-[10px] bg-surface-2 text-ink-2 flex items-center justify-center shrink-0"><Icon className="w-[18px] h-[18px]" aria-hidden /></span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-semibold truncate">{m.titulo}</span>
              <span className="text-xs text-ink-3">{TIPOS[m.tipo].label} · {m.periodo === "MONTHLY" ? "Mensal" : "Semanal"}</span>
              <span className="text-xs text-ink-2 truncate">{m.note}</span>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1 order-last md:order-none flex flex-col gap-1.5 min-w-0">
            <div className="flex justify-between items-baseline gap-2 text-[13px]">
              <span className="text-ink-3"><span className="font-semibold text-ink">{fmt(m.tipo, m.atual)}</span> de {fmt(m.tipo, m.valorAlvo)}</span>
              <span className="font-semibold">{m.pct}%</span>
            </div>
            <div className="relative h-2 rounded-full bg-surface-2">
              <div className={cn("h-full rounded-full", m.status === "done" ? "bg-positive-strong" : "bg-ink")} style={{ width: `${Math.min(m.pct, 100)}%` }} />
              {m.expectedPct != null && m.status !== "done" && (
                <div className="absolute -top-1 -bottom-1 w-0.5 bg-primary" style={{ left: `${m.expectedPct}%` }} title={`Onde deveria estar hoje: ${m.expectedPct}%`} />
              )}
            </div>
          </div>
          <span className={cn("hidden md:flex h-6 px-2.5 rounded-full text-xs font-semibold items-center whitespace-nowrap", sCls)}>{sLabel}</span>
          <button type="button" onClick={() => openEdit(m)} aria-label={`Editar meta ${m.titulo}${m.barberName ? ` de ${m.barberName}` : ""}`} aria-pressed={selected}
            className={cn("w-9 h-9 rounded-[9px] border bg-surface flex items-center justify-center hover:bg-surface-2", selected ? "border-primary" : "border-control")}>
            <Pencil className="w-[15px] h-[15px]" aria-hidden />
          </button>
        </div>
      </div>
    );
  };

  const group = (title: string, sub: string, items: Meta[], byBarber: boolean) => (
    <section aria-label={title} className="bg-surface border border-line rounded-2xl overflow-hidden">
      <div className="flex flex-wrap justify-between items-center gap-3 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <span className="text-[13px] text-ink-3">{sub}</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-ink-3"><span className="w-0.5 h-3.5 bg-primary" />onde deveria estar hoje</span>
      </div>
      {items.length === 0 && <div className="px-5 py-6 border-t border-line-2 text-[13px] text-ink-3">Nenhuma meta neste período.</div>}
      {items.map((m, i) => row(m, byBarber && (i === 0 || items[i - 1].barberId !== m.barberId), items.filter((x) => x.barberId === m.barberId).length))}
    </section>
  );

  const panel = (
    <SidePanel open={!!form} wide={wide} onClose={() => setForm(null)} label={form?.mode === "edit" ? "Editar meta" : "Nova meta"}
      footer={
        <div className="flex items-center gap-2">
          <Button onClick={save} loading={busy} className="flex-1">{form?.mode === "edit" ? "Salvar alterações" : "Criar meta"}</Button>
          {form?.mode === "edit" ? (
            confirmDel
              ? <Button variant="danger" onClick={remove} loading={busy}>Confirmar</Button>
              : <Button variant="outline" onClick={() => setConfirmDel(true)}><Trash2 className="w-4 h-4 mr-1.5" aria-hidden />Excluir</Button>
          ) : <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>}
        </div>
      }>
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[17px] font-semibold">{form?.mode === "edit" ? "Editar meta" : "Nova meta"}</h2>
          <span className="text-[13px] text-ink-3">
            {editing ? `${editing.barberName ?? "Barbearia"} · ${STATUS[editing.status][0].toLowerCase()}` : "Começa a contar a partir do início do período"}
          </span>
        </div>
        {wide && <button type="button" onClick={() => setForm(null)} aria-label="Fechar painel" className="w-9 h-9 rounded-lg text-ink-3 hover:bg-surface-2 flex items-center justify-center"><X className="w-[18px] h-[18px]" aria-hidden /></button>}
      </div>
      <div className="px-5 pb-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Nome da meta</span>
          <input className={fieldCls} value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: 100 atendimentos no mês" />
        </label>

        {form?.mode === "new" ? (
          <>
            <div role="group" aria-labelledby="tipo-l" className="flex flex-col gap-2">
              <span id="tipo-l" className="text-[13px] font-semibold text-ink-2">O que medir</span>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TIPOS) as Tipo[]).map((k) => (
                  <button key={k} type="button" aria-pressed={tipo === k} onClick={() => setTipo(k)}
                    className={cn("flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border text-left", tipo === k ? "border-primary ring-1 ring-primary bg-primary/5" : "border-control bg-surface hover:bg-surface-2")}>
                    <span className="text-sm font-semibold">{TIPOS[k].label}</span>
                    <span className="text-xs text-ink-3">{TIPOS[k].hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-ink-2">Período</span>
              <Segmented value={periodo} onChange={setPeriodo} label="Período" options={[["MONTHLY", "Mensal"], ["WEEKLY", "Semanal"]]} />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-2">Para quem</span>
              <select className={fieldCls} value={barberId} onChange={(e) => setBarberId(e.target.value)} disabled={tipo === "ASSINANTES"}>
                <option value="">Barbearia toda</option>
                {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {tipo === "ASSINANTES" && <span className="text-xs text-ink-3">Assinantes são da barbearia toda.</span>}
            </label>
          </>
        ) : editing && (
          <div className="flex flex-col rounded-xl border border-line-2 text-[13px]">
            {[["O que mede", TIPOS[editing.tipo].label], ["Período", editing.periodo === "MONTHLY" ? "Mensal" : "Semanal"], ["Para quem", editing.barberName ?? "Barbearia toda"]].map(([a, b], i) => (
              <div key={a} className={cn("flex justify-between gap-3 px-3.5 py-2.5", i > 0 && "border-t border-line-2")}><span className="text-ink-3">{a}</span><span className="font-semibold">{b}</span></div>
            ))}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">{curPeriodo === "MONTHLY" ? "Quanto no mês" : "Quanto na semana"}</span>
          <span className="flex items-center h-11 rounded-[10px] border border-control bg-surface px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            {curTipo === "RECEITA" && <span className="text-sm text-ink-3 mr-1.5">R$</span>}
            <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={TIPOS[curTipo].placeholder} className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
            {curTipo !== "RECEITA" && <span className="text-sm text-ink-3 ml-1.5">{TIPOS[curTipo].unit}</span>}
          </span>
        </label>

        {editing && (
          <div className={cn("px-3.5 py-3 rounded-xl text-[13px] leading-snug flex flex-col gap-0.5",
            editing.status === "slight" || editing.status === "behind" ? "bg-warning-soft text-warning" : "bg-positive-soft text-positive")}>
            <span className="font-semibold">{editing.status === "slight" || editing.status === "behind" ? "Para chegar lá" : "Como está indo"}</span>
            <span>{fmt(editing.tipo, editing.atual)} de {fmt(editing.tipo, editing.valorAlvo)} ({editing.pct}%). {editing.plan}</span>
          </div>
        )}
        {editing && (
          <span className="flex items-start gap-1.5 text-xs text-ink-3"><Lock className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden />O que mede, período e profissional não mudam depois de criada. Para trocar, exclua e crie outra.</span>
        )}
        {confirmDel && <p className="text-[13px] text-danger">Excluir esta meta? O barbeiro deixa de ver ela no painel dele.</p>}
      </div>
    </SidePanel>
  );

  return (
    <div className="flex flex-col gap-5">
      {header}

      <section aria-label="Tempo do período e situação das metas" className="bg-surface border border-line rounded-2xl grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] divide-y lg:divide-y-0 lg:divide-x divide-line-2">
        <PeriodBar title={`${monthLabel(d.today)} · dia ${d.month.day} de ${d.month.totalDays}`} right={`${mPct}% do mês passou`} pct={mPct}
          foot={`Faltam ${d.month.totalDays - d.month.day} dias · ${d.month.openRemaining} com a barbearia aberta`} />
        <PeriodBar title={`Semana · dia ${d.week.day} de 7`} right={`${wPct}% da semana passou`} pct={wPct}
          foot={`${dm(d.week.start)} a ${dm(d.week.end)}`} />
        <div className="flex items-center gap-2 px-[22px] py-[18px] overflow-x-auto">
          {counts.map(({ k, n }) => (
            <div key={k} className={cn("flex flex-col items-center justify-center min-w-[74px] h-[64px] rounded-xl px-2", STATUS[k][1])}>
              <span className="font-display text-[22px] font-bold leading-none">{n}</span>
              <span className="text-[11px] font-semibold whitespace-nowrap mt-1">{STATUS[k][0]}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {d.metas.length === 0 ? (
            <div className="bg-surface border border-line rounded-2xl px-6 py-10 flex flex-col items-center text-center gap-3">
              <CalendarCheck className="w-8 h-8 text-ink-3" aria-hidden />
              <h2 className="text-[17px] font-semibold">Nenhuma meta ainda</h2>
              <p className="text-sm text-ink-3 max-w-md">Crie uma meta de atendimentos, receita, assinantes ou ocupação, para a barbearia ou para cada barbeiro. O barbeiro vê a meta de receita dele no Início.</p>
              <Button onClick={openNew}><Plus className="w-4 h-4 mr-1.5" aria-hidden />Criar a primeira meta</Button>
            </div>
          ) : (
            <>
              {group("Barbearia", "Metas da casa toda", shop, false)}
              {group("Por profissional", "Cada barbeiro vê a própria meta de receita no painel dele", team, true)}
            </>
          )}
        </div>
        {wide && panel}
      </div>
      {!wide && panel}
    </div>
  );
}
