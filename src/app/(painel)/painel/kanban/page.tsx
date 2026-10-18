"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, getInitials } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { fieldCls } from "@/components/catalogo/SidePanel";

type Status = "TODO" | "DOING" | "DONE";
type Priority = "LOW" | "NORMAL" | "HIGH";
interface Task {
  id: string; title: string; description: string | null; status: Status; priority: Priority;
  dueDate: string | null; createdAt: string; updatedAt: string;
  barberId: string | null; barber: { id: string; nickname?: string | null; user: { name: string } } | null;
}

const COLS: { key: Status; label: string; dot: string }[] = [
  { key: "TODO", label: "A fazer", dot: "bg-ink-4" },
  { key: "DOING", label: "Fazendo", dot: "bg-warning" },
  { key: "DONE", label: "Feito", dot: "bg-positive" },
];
const ORDER: Status[] = ["TODO", "DOING", "DONE"];
const PRIO: Record<Priority, [string, string]> = {
  HIGH: ["Alta", "bg-danger-soft text-danger"],
  NORMAL: ["Normal", "bg-surface-2 text-ink-2"],
  LOW: ["Baixa", "bg-ground text-ink-3"],
};
const todayKey = () => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date());
const dueKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const nameOf = (t: Task) => (t.barber ? t.barber.nickname || t.barber.user.name.split(" ")[0] : null);
const DONE_SHOWN = 12;

export default function KanbanPage() {
  const { token } = useAuthStore();
  const h = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [barbers, setBarbers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<string>("all"); // all | team | late | <barberId>
  const [allDone, setAllDone] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [who, setWho] = useState("");
  const [due, setDue] = useState("");
  const [prio, setPrio] = useState<Priority>("NORMAL");
  const [details, setDetails] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([fetch("/api/barbershop/tasks", { headers: h }), fetch("/api/barbershop/barbers", { headers: h })]);
      if (!r1.ok) throw new Error();
      setTasks((await r1.json()).tasks ?? []);
      if (r2.ok) setBarbers(((await r2.json()).barbers ?? []).map((b: { id: string; nickname?: string | null; user: { name: string } }) => ({ id: b.id, name: b.nickname || b.user.name })));
    } catch {
      setError(true);
    }
  }, [h]);
  useEffect(() => { load(); }, [load]);

  const today = todayKey();
  const isLate = (t: Task) => t.status !== "DONE" && !!t.dueDate && dueKey(t.dueDate) < today;

  async function add() {
    if (!title.trim()) return toast.error("Escreva o que precisa ser feito");
    setAdding(true);
    try {
      const r = await fetch("/api/barbershop/tasks", {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: details, priority: prio, barberId: who || null, dueDate: due || null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Não foi possível adicionar");
      setTasks((ts) => [j.task, ...(ts ?? [])]);
      setTitle(""); setDetails(""); setShowDetails(false); setDue(""); setPrio("NORMAL");
      toast.success("Tarefa adicionada em A fazer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível adicionar");
    } finally {
      setAdding(false);
    }
  }

  async function move(t: Task, dir: 1 | -1) {
    const status = ORDER[ORDER.indexOf(t.status) + dir];
    if (!status) return;
    const prev = tasks;
    setTasks((ts) => ts?.map((x) => (x.id === t.id ? { ...x, status, updatedAt: new Date().toISOString() } : x)) ?? null);
    const r = await fetch(`/api/barbershop/tasks/${t.id}`, { method: "PATCH", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => null);
    if (!r?.ok) { setTasks(prev); toast.error("Não foi possível mover a tarefa"); }
  }

  async function remove(t: Task) {
    if (confirmDel !== t.id) return setConfirmDel(t.id);
    const prev = tasks;
    setTasks((ts) => ts?.filter((x) => x.id !== t.id) ?? null);
    setConfirmDel(null);
    const r = await fetch(`/api/barbershop/tasks/${t.id}`, { method: "DELETE", headers: h }).catch(() => null);
    if (!r?.ok) { setTasks(prev); toast.error("Não foi possível excluir"); }
  }

  const header = (open: number, late: number, doneWeek: number) => (
    <header className="flex items-end justify-between gap-3 flex-wrap">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Tarefas da equipe</h1>
        <span className="text-sm text-ink-3">
          {open} {open === 1 ? "aberta" : "abertas"}
          {late > 0 && <> · <span className="font-semibold text-danger">{late} {late === 1 ? "vencida" : "vencidas"}</span></>}
          {" "}· {doneWeek} {doneWeek === 1 ? "feita" : "feitas"} esta semana
        </span>
      </div>
      <span className="text-[13px] text-ink-3 max-w-[360px]">Cada profissional vê as tarefas dele e as da equipe no celular e marca como feita por lá.</span>
    </header>
  );

  if (error) return <div className="flex flex-col gap-5">{header(0, 0, 0)}<p role="alert" className="rounded-2xl bg-danger-soft text-danger px-5 py-4 text-sm">Não foi possível carregar as tarefas. <button type="button" className="font-semibold underline" onClick={() => { setError(false); load(); }}>Tentar de novo</button></p></div>;
  if (!tasks) return <div className="flex flex-col gap-5"><div className="h-14" /><div className="h-24 rounded-2xl bg-surface border border-line animate-pulse" /><div className="h-96 rounded-2xl bg-surface border border-line animate-pulse" /></div>;

  const open = tasks.filter((t) => t.status !== "DONE");
  const late = open.filter(isLate);
  const monday = (() => { const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const doneWeek = tasks.filter((t) => t.status === "DONE" && t.updatedAt.slice(0, 10) >= monday).length;

  const people = [
    { id: "all", label: "Todos", initials: "", count: open.length },
    ...barbers.map((b) => ({ id: b.id, label: b.name.split(" ")[0], initials: getInitials(b.name), count: open.filter((t) => t.barberId === b.id).length })),
    { id: "team", label: "Equipe toda", initials: "EQ", count: open.filter((t) => !t.barberId).length },
  ];
  const visible = tasks.filter((t) =>
    filter === "all" ? true : filter === "team" ? !t.barberId : filter === "late" ? isLate(t) : t.barberId === filter);
  const rank = (t: Task) => (isLate(t) ? "0" : "1") + (t.dueDate ? dueKey(t.dueDate) : "9999") + (t.priority === "HIGH" ? "0" : t.priority === "NORMAL" ? "1" : "2");

  const card = (t: Task) => {
    const lateT = isLate(t);
    const dk = t.dueDate ? dueKey(t.dueDate) : null;
    const who = nameOf(t);
    const i = ORDER.indexOf(t.status);
    return (
      <article key={t.id} className={cn("bg-surface rounded-xl border p-3.5 flex flex-col gap-2.5", lateT ? "border-danger/40" : "border-line", t.status === "DONE" && "opacity-75")}>
        <h3 className={cn("text-sm font-semibold leading-snug", t.status === "DONE" && "line-through decoration-ink-4")}>{t.title}</h3>
        {t.description && <p className="text-[13px] text-ink-3 leading-snug -mt-1">{t.description}</p>}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn("h-[22px] px-2 rounded-full text-[11px] font-semibold flex items-center", PRIO[t.priority][1])}>{PRIO[t.priority][0]}</span>
          {dk && t.status !== "DONE" && (
            <span className={cn("h-[22px] px-2 rounded-full text-[11px] font-semibold flex items-center gap-1",
              lateT ? "bg-danger-soft text-danger" : dk === today ? "bg-warning-soft text-warning" : "bg-ground text-ink-2")}>
              <CalendarDays className="w-3 h-3" aria-hidden />
              {lateT ? `Venceu ${ddmm(dk)}` : dk === today ? "Vence hoje" : ddmm(dk)}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-2">
            <span className="w-[22px] h-[22px] rounded-full bg-surface-2 text-[10px] font-bold flex items-center justify-center">{who ? getInitials(who) : "EQ"}</span>
            {who ?? "Equipe"}
          </span>
        </div>
        <div className="flex items-center gap-1 pt-2 border-t border-line-2">
          {i > 0 && (
            <button type="button" onClick={() => move(t, -1)} aria-label={`Voltar para ${COLS[i - 1].label}`} className="h-8 px-2 rounded-lg text-xs font-semibold text-ink-2 flex items-center gap-0.5 hover:bg-surface-2">
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden />{COLS[i - 1].label}
            </button>
          )}
          <span className="flex-1" />
          <button type="button" onClick={() => remove(t)} aria-label={confirmDel === t.id ? "Confirmar exclusão" : `Excluir tarefa ${t.title}`}
            className={cn("h-8 rounded-lg text-xs font-semibold flex items-center justify-center", confirmDel === t.id ? "px-2.5 bg-danger-strong text-white" : "w-8 text-ink-4 hover:text-danger hover:bg-surface-2")}>
            {confirmDel === t.id ? "Excluir?" : <Trash2 className="w-3.5 h-3.5" aria-hidden />}
          </button>
          {i < 2 && (
            <button type="button" onClick={() => move(t, 1)} aria-label={`Mover para ${COLS[i + 1].label}`}
              className="h-8 px-2.5 rounded-lg border border-control text-xs font-semibold flex items-center gap-0.5 hover:bg-surface-2">
              {COLS[i + 1].label}<ChevronRight className="w-3.5 h-3.5" aria-hidden />
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {header(open.length, late.length, doneWeek)}

      <section aria-label="Adicionar tarefa" className="bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3">
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_180px_160px_auto_auto] items-end">
          <input aria-label="O que precisa ser feito" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)}
            placeholder="O que precisa ser feito? Ex.: Organizar a recepção" className={fieldCls} />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-3">Quem faz</span>
            <select aria-label="Quem faz" value={who} onChange={(e) => setWho(e.target.value)} className={fieldCls}>
              <option value="">Equipe toda</option>
              {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-3">Prazo</span>
            <input type="date" aria-label="Prazo" value={due} min={today} onChange={(e) => setDue(e.target.value)} className={fieldCls} />
          </label>
          <div role="radiogroup" aria-label="Prioridade" className="flex p-1 gap-0.5 rounded-[10px] bg-track h-11">
            {(["LOW", "NORMAL", "HIGH"] as Priority[]).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={prio === p} onClick={() => setPrio(p)}
                className={cn("px-3 rounded-[7px] text-[13px] font-semibold", prio === p ? "bg-surface text-ink shadow-[0_1px_2px_rgba(27,25,22,0.12)]" : "text-ink-2")}>
                {PRIO[p][0]}
              </button>
            ))}
          </div>
          <Button type="submit" loading={adding} className="h-11">Adicionar</Button>
        </form>
        <button type="button" onClick={() => setShowDetails(!showDetails)} aria-expanded={showDetails} className="self-start text-[13px] font-semibold text-ink-2 hover:text-ink">
          {showDetails ? "− Sem detalhes" : "+ Adicionar detalhes"}
        </button>
        {showDetails && (
          <textarea rows={2} aria-label="Detalhes da tarefa" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)}
            placeholder="Detalhes para quem vai fazer (opcional)" className={cn(fieldCls, "h-auto py-2.5 resize-none")} />
        )}
      </section>

      <div role="group" aria-label="Filtrar por pessoa" className="flex gap-2 flex-wrap">
        {people.map((p) => (
          <button key={p.id} type="button" aria-pressed={filter === p.id} onClick={() => setFilter(p.id)}
            className={cn("h-9 rounded-full border text-[13px] font-semibold flex items-center gap-1.5 pr-3", p.initials ? "pl-1" : "pl-3.5",
              filter === p.id ? "bg-ink text-white border-ink" : "bg-surface border-control")}>
            {p.initials && <span className={cn("w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center", filter === p.id ? "bg-night-3 text-white" : "bg-surface-2 text-ink-2")}>{p.initials}</span>}
            {p.label}
            <span className={cn("text-xs", filter === p.id ? "text-white/70" : "text-ink-3")}>{p.count}</span>
          </button>
        ))}
        {late.length > 0 && (
          <button type="button" aria-pressed={filter === "late"} onClick={() => setFilter(filter === "late" ? "all" : "late")}
            className={cn("h-9 px-3.5 rounded-full border text-[13px] font-semibold", filter === "late" ? "bg-danger-strong text-white border-danger-strong" : "bg-danger-soft text-danger border-danger/30")}>
            Só vencidas · {late.length}
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        {COLS.map((col) => {
          let items = visible.filter((t) => t.status === col.key);
          items = col.key === "DONE" ? items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : items.sort((a, b) => rank(a).localeCompare(rank(b)));
          const hidden = col.key === "DONE" && !allDone ? Math.max(0, items.length - DONE_SHOWN) : 0;
          const shown = hidden ? items.slice(0, DONE_SHOWN) : items;
          const lateN = items.filter(isLate).length;
          return (
            <section key={col.key} aria-label={col.label} className="bg-ground/70 border border-line rounded-2xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 px-1 py-1">
                <span className={cn("w-2 h-2 rounded-full", col.dot)} />
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <span className="text-xs text-ink-3">{items.length}</span>
                {lateN > 0 && <span className="ml-auto h-[22px] px-2 rounded-full bg-danger-soft text-danger text-[11px] font-semibold flex items-center">{lateN} {lateN === 1 ? "vencida" : "vencidas"}</span>}
              </div>
              {shown.map(card)}
              {items.length === 0 && <div className="py-8 text-center text-[13px] text-ink-4 border border-dashed border-line rounded-xl">Nenhuma tarefa aqui</div>}
              {hidden > 0 && (
                <button type="button" onClick={() => setAllDone(true)} className="text-[13px] font-semibold text-ink-2 py-2 hover:text-ink">Ver mais {hidden} feitas</button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
