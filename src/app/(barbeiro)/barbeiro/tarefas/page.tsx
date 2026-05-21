"use client";
import { useEffect, useState, useCallback } from "react";
import { CheckCircle, Circle, Calendar, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth";

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
  barberId: string | null;
  barber: { id: string; user: { name: string; email: string } } | null;
}

const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: "bg-zinc-100 text-zinc-500",
  NORMAL: "bg-primary/10 text-primary/90",
  HIGH: "bg-red-50 text-red-500",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
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

export default function BarbeiroTarefasPage() {
  const { token, user } = useAuthStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/barbershop/tasks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (res.ok) {
        // Filtrar apenas as tarefas do barbeiro logado ou tarefas gerais (barberId nulo)
        const myTasks = (data.tasks || []).filter(
          (t: Task) => !t.barberId || t.barber?.user?.email === user?.email
        );
        setTasks(myTasks);
      }
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleTaskStatus(task: Task) {
    if (updating) return;
    setUpdating(task.id);
    
    const newStatus = task.status === "DONE" ? "TODO" : "DONE";
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    try {
      await fetch(`/api/barbershop/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // Revert in case of error
      load();
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => t.status !== "DONE");
  const doneTasks = tasks.filter(t => t.status === "DONE");

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Minhas Tarefas</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Acompanhe seu checklist diário e metas da barbearia.
        </p>
      </div>

      {pendingTasks.length === 0 && doneTasks.length === 0 && (
        <div className="bg-white rounded-xl border border-zinc-100 p-8 text-center shadow-sm">
          <CheckCircle className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="font-semibold text-zinc-900">Nenhuma tarefa pendente!</p>
          <p className="text-sm text-zinc-500 mt-1">Sua lista está limpa.</p>
        </div>
      )}

      {pendingTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">Para Fazer ({pendingTasks.length})</h2>
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
            {pendingTasks.map((task, idx) => {
              const ds = dueDateStatus(task.dueDate, task.status);
              const isOverdue = ds === "overdue";
              
              return (
                <div 
                  key={task.id} 
                  className={`flex items-start gap-4 p-4 transition-colors hover:bg-zinc-50 ${idx !== pendingTasks.length - 1 ? 'border-b border-zinc-100' : ''}`}
                >
                  <button 
                    onClick={() => toggleTaskStatus(task)}
                    disabled={updating === task.id}
                    className="mt-0.5 shrink-0 text-zinc-300 hover:text-green-500 transition-colors disabled:opacity-50"
                  >
                    {updating === task.id ? (
                      <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-zinc-900 ${isOverdue ? 'text-red-600' : ''}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-sm text-zinc-500 mt-0.5 leading-relaxed">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_BADGE[task.priority]}`}>
                        {PRIORITY_LABEL[task.priority]}
                      </span>
                      {!task.barberId && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                          Equipe
                        </span>
                      )}
                      {task.dueDate && (
                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-zinc-50 text-zinc-500 border border-zinc-200'}`}>
                          {isOverdue && <AlertCircle className="w-3 h-3" />}
                          <Calendar className="w-3 h-3" />
                          {new Date(task.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {doneTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wide">Concluídas ({doneTasks.length})</h2>
          <div className="bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden opacity-70">
            {doneTasks.map((task, idx) => (
              <div 
                key={task.id} 
                className={`flex items-start gap-4 p-4 ${idx !== doneTasks.length - 1 ? 'border-b border-zinc-200' : ''}`}
              >
                <button 
                  onClick={() => toggleTaskStatus(task)}
                  disabled={updating === task.id}
                  className="mt-0.5 shrink-0 text-green-500 transition-colors disabled:opacity-50"
                >
                  {updating === task.id ? (
                    <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-6 h-6" />
                  )}
                </button>
                <div className="flex-1 min-w-0 line-through text-zinc-500">
                  <p className="font-semibold">{task.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
