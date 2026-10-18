"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

type Status = "TODO" | "DOING" | "DONE";
type Priority = "LOW" | "NORMAL" | "HIGH";
interface Task { id: string; title: string; description: string | null; status: Status; priority: Priority; dueDate: string | null; barberId: string | null }

const PRIORITY: Record<Priority, [string, string]> = {
  HIGH: ["Alta", "bg-danger-soft text-danger"],
  NORMAL: ["Normal", "bg-surface-2 text-ink-2"],
  LOW: ["Baixa", "bg-surface-3 text-ink-3"],
};
const todayKey = () => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date());
const dueKey = (iso: string) => iso.slice(0, 10);

function dueText(iso: string) {
  const k = dueKey(iso);
  const t = todayKey();
  if (k < t) return ["atrasada", "text-danger font-semibold"] as const;
  if (k === t) return ["vence hoje", "text-warning font-semibold"] as const;
  return [`até ${k.slice(8)}/${k.slice(5, 7)}`, "text-ink-3"] as const;
}

export default function BarbeiroTarefasPage() {
  const { token } = useAuthStore();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/barbershop/tasks", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({}));
    setTasks(d.tasks || []);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function toggle(t: Task) {
    const status: Status = t.status === "DONE" ? "TODO" : "DONE";
    setBusy(t.id);
    setTasks((cur) => cur && cur.map((x) => (x.id === t.id ? { ...x, status } : x)));
    const r = await fetch(`/api/barbershop/tasks/${t.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }),
    }).catch(() => null);
    setBusy(null);
    if (!r?.ok) { toast.error("Não deu certo. Tente de novo."); load(); }
  }

  const rank = (t: Task) => (t.dueDate ? dueKey(t.dueDate) : "9999") + (t.priority === "HIGH" ? "0" : t.priority === "NORMAL" ? "1" : "2");
  const open = (tasks ?? []).filter((t) => t.status !== "DONE").sort((a, b) => rank(a).localeCompare(rank(b)));
  const done = (tasks ?? []).filter((t) => t.status === "DONE");
  const late = open.filter((t) => t.dueDate && dueKey(t.dueDate) < todayKey()).length;

  const row = (t: Task) => {
    const isDone = t.status === "DONE";
    const due = t.dueDate && !isDone ? dueText(t.dueDate) : null;
    return (
      <div key={t.id} className="flex items-start gap-3 px-4 py-3.5">
        <button type="button" onClick={() => toggle(t)} disabled={busy === t.id} role="checkbox" aria-checked={isDone} aria-label={isDone ? `Reabrir ${t.title}` : `Concluir ${t.title}`}
          className={cn("w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 disabled:opacity-50", isDone ? "bg-positive-strong border-positive-strong text-white" : "border-control hover:border-ink")}>
          {isDone && <Check className="w-3.5 h-3.5" aria-hidden />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn("text-[15px] font-semibold", isDone && "line-through text-ink-3")}>{t.title}</p>
          {t.description && !isDone && <p className="text-[13px] text-ink-2 mt-0.5 leading-snug">{t.description}</p>}
          {!isDone && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
              <span className={cn("h-5 px-2 rounded-full font-semibold inline-flex items-center", PRIORITY[t.priority][1])}>{PRIORITY[t.priority][0]}</span>
              <span className="text-ink-3">{t.barberId ? "só sua" : "da equipe"}</span>
              {due && <span className={due[1]}>· {due[0]}</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Tarefas</h1>
        <span className="text-sm text-ink-3">{tasks ? `${open.length} para fazer${late ? ` · ${late} atrasada${late === 1 ? "" : "s"}` : ""}` : " "}</span>
      </header>

      {!tasks ? <div className="h-48 rounded-2xl bg-surface-3/60 animate-pulse" /> : tasks.length === 0 ? (
        <div className="rounded-2xl bg-surface border border-line px-6 py-12 flex flex-col items-center gap-2 text-center">
          <CheckCircle2 className="w-9 h-9 text-ink-4" aria-hidden />
          <p className="font-semibold">Nenhuma tarefa</p>
          <p className="text-[13px] text-ink-3">Quando o dono passar alguma coisa para você ou para a equipe, aparece aqui.</p>
        </div>
      ) : (
        <>
          <section aria-label="Para fazer" className="bg-surface border border-line rounded-2xl overflow-hidden">
            <h2 className="px-4 pt-3.5 pb-1 text-xs font-semibold tracking-[0.06em] uppercase text-ink-3">Para fazer · {open.length}</h2>
            {open.length === 0 ? <p className="px-4 pb-4 text-[13px] text-ink-3">Tudo feito. 👏</p> : <div className="divide-y divide-line-3">{open.map(row)}</div>}
          </section>
          {done.length > 0 && (
            <section aria-label="Concluídas" className="bg-surface border border-line rounded-2xl overflow-hidden">
              <h2 className="px-4 pt-3.5 pb-1 text-xs font-semibold tracking-[0.06em] uppercase text-ink-3">Concluídas · {done.length}</h2>
              <div className="divide-y divide-line-3">{done.slice(0, 10).map(row)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
