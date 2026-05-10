"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronRight, ChevronLeft, User, Calendar, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getInitials } from "@/lib/utils";

type Status = "TODO" | "DOING" | "DONE";
type Priority = "LOW" | "NORMAL" | "HIGH";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  barber: { id: string; user: { name: string } } | null;
}

interface Barber {
  id: string;
  user: { name: string };
}

const COLUMNS: { key: Status; label: string; color: string; bg: string }[] = [
  { key: "TODO",  label: "A Fazer",      color: "text-zinc-500",  bg: "bg-zinc-50 border-zinc-200" },
  { key: "DOING", label: "Em Andamento", color: "text-blue-600",  bg: "bg-blue-50 border-blue-200" },
  { key: "DONE",  label: "Concluído",    color: "text-green-600", bg: "bg-green-50 border-green-200" },
];

const PRIORITY_BADGE: Record<Priority, string> = {
  LOW:    "bg-zinc-100 text-zinc-500",
  NORMAL: "bg-amber-50 text-amber-600",
  HIGH:   "bg-red-50 text-red-500",
};
const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Baixa", NORMAL: "Normal", HIGH: "Alta",
};

function dueDateStatus(dueDate: string | null, status: Status) {
  if (!dueDate || status === "DONE") return null;
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 2) return "soon";
  return "ok";
}

function DueDateBadge({ dueDate, status }: { dueDate: string | null; status: Status }) {
  if (!dueDate) return null;
  const s = dueDateStatus(dueDate, status);
  const date = new Date(dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const styles: Record<string, string> = {
    overdue: "bg-red-50 text-red-500 border border-red-200",
    soon:    "bg-amber-50 text-amber-600 border border-amber-200",
    ok:      "bg-zinc-50 text-zinc-500 border border-zinc-200",
  };

  return (
    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${styles[s!] || styles.ok}`}>
      {s === "overdue" && <AlertCircle className="w-3 h-3" />}
      <Calendar className="w-3 h-3" />
      {s === "overdue" ? `Venceu ${date}` : date}
    </span>
  );
}

function TaskCard({
  task,
  isOwner,
  onMove,
  onDelete,
}: {
  task: Task;
  isOwner: boolean;
  onMove: (id: string, dir: "prev" | "next") => void;
  onDelete: (id: string) => void;
}) {
  const statusOrder: Status[] = ["TODO", "DOING", "DONE"];
  const idx = statusOrder.indexOf(task.status);
  const ds = dueDateStatus(task.dueDate, task.status);

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 space-y-2 group ${ds === "overdue" ? "border-red-200" : "border-zinc-100"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900 leading-snug">{task.title}</p>
        {isOwner && (
          <button
            onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-zinc-300 hover:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-zinc-400 leading-relaxed">{task.description}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap pt-1">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_BADGE[task.priority]}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
        {task.barber && (
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold">
              {getInitials(task.barber.user.name)}
            </span>
            {task.barber.user.name.split(" ")[0]}
          </span>
        )}
        <DueDateBadge dueDate={task.dueDate} status={task.status} />
      </div>

      <div className="flex gap-1 pt-1">
        {idx > 0 && (
          <button
            onClick={() => onMove(task.id, "prev")}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 px-2 py-1 rounded hover:bg-zinc-50 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
            {COLUMNS[idx - 1].label}
          </button>
        )}
        {idx < 2 && (
          <button
            onClick={() => onMove(task.id, "next")}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 px-2 py-1 rounded hover:bg-zinc-50 transition-colors ml-auto"
          >
            {COLUMNS[idx + 1].label}
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const { token, user } = useAuthStore();
  const isOwner = user?.role === "OWNER";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "NORMAL" as Priority, barberId: "", dueDate: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const [tRes, bRes] = await Promise.all([
      fetch("/api/barbershop/tasks", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/barbershop/barbers", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const tData = await tRes.json();
    const bData = await bRes.json();
    setTasks(tData.tasks || []);
    setBarbers(bData.barbers || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/barbershop/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...form,
        barberId: form.barberId || null,
        dueDate: form.dueDate || null,
      }),
    });
    setSaving(false);
    setShowModal(false);
    setForm({ title: "", description: "", priority: "NORMAL", barberId: "", dueDate: "" });
    load();
  }

  async function handleMove(id: string, dir: "prev" | "next") {
    const order: Status[] = ["TODO", "DOING", "DONE"];
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const idx = order.indexOf(task.status);
    const newStatus = dir === "next" ? order[idx + 1] : order[idx - 1];
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: newStatus } : t));
    await fetch(`/api/barbershop/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/barbershop/tasks/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  const overdueCount = tasks.filter((t) => dueDateStatus(t.dueDate, t.status) === "overdue").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Kanban</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Organize e atribua tarefas para os barbeiros
            {overdueCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-500 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {overdueCount} vencida{overdueCount > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova Tarefa
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key);
            const colOverdue = colTasks.filter((t) => dueDateStatus(t.dueDate, t.status) === "overdue").length;
            return (
              <div key={col.key} className={`rounded-xl border p-4 ${col.bg}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-sm font-bold uppercase tracking-wide ${col.color}`}>{col.label}</h2>
                  <div className="flex items-center gap-1.5">
                    {colOverdue > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-500">
                        {colOverdue} venc.
                      </span>
                    )}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white border ${col.color}`}>
                      {colTasks.length}
                    </span>
                  </div>
                </div>
                <div className="space-y-3 min-h-[120px]">
                  {colTasks.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-6">Nenhuma tarefa</p>
                  ) : (
                    colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isOwner={isOwner}
                        onMove={handleMove}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-zinc-100">
              <h2 className="font-bold text-zinc-900">Nova Tarefa</h2>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Título *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Limpar as tesouras"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Detalhes opcionais..."
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Prioridade</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="LOW">Baixa</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                    <User className="w-3 h-3 inline mr-1" />Barbeiro
                  </label>
                  <select
                    value={form.barberId}
                    onChange={(e) => setForm((f) => ({ ...f, barberId: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="">Todos</option>
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>{b.user.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />Prazo (opcional)
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60"
                >
                  {saving ? "Criando..." : "Criar Tarefa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
