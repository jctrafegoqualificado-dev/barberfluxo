"use client";
import { useEffect, useState } from "react";
import { Megaphone, Send, Trash2, CheckCheck, Clock } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface Notice {
  id: string;
  content: string;
  authorName: string | null;
  createdAt: string;
  readBy: { barberId: string; name: string; readAt: string }[];
}
interface TeamMember { id: string; name: string }

const MAX_LENGTH = 500;

function whenLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `hoje, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `ontem, ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${time}`;
}

export default function RecadosPage() {
  const { token } = useAuthStore();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Notice | null>(null);

  async function load() {
    const r = await fetch("/api/barbershop/recados", { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    setNotices(d.notices ?? []);
    setTeam(d.team ?? []);
    setLoading(false);
  }

  useEffect(() => { if (token) load(); }, [token]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    setFeedback(null);
    const r = await fetch("/api/barbershop/recados", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content, notifyWhatsApp }),
    });
    const d = await r.json();
    setSending(false);
    if (!r.ok) { setFeedback(d.error ?? "Erro ao publicar o recado."); return; }
    setContent("");
    setFeedback(
      notifyWhatsApp && d.notified > 0
        ? `Recado publicado e enviado no WhatsApp para ${d.notified} profissional(is).`
        : "Recado publicado. A equipe vê no início do sistema."
    );
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await fetch(`/api/barbershop/recados/${toDelete.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setToDelete(null);
    load();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-primary" /> Recados da equipe
        </h1>
        <p className="text-zinc-500 text-xs mt-0.5">
          Avisos para os profissionais. Aparecem no início do sistema de cada um, e você vê quem já leu.
        </p>
      </div>

      <form onSubmit={handleSend} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 space-y-3">
        <label htmlFor="recado" className="block text-sm font-semibold text-zinc-800">Novo recado</label>
        <textarea
          id="recado"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={MAX_LENGTH}
          rows={3}
          placeholder="Ex: Sábado (19) abrimos às 7h. Quem puder começar mais cedo, libera a agenda até sexta."
          className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyWhatsApp}
              onChange={(e) => setNotifyWhatsApp(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            Avisar a equipe no WhatsApp
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">{content.length} de {MAX_LENGTH}</span>
            <button
              type="submit"
              disabled={sending || !content.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              <Send className="w-4 h-4" /> {sending ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </div>
        {feedback && <p className="text-xs text-zinc-600" role="status">{feedback}</p>}
      </form>

      <div className="space-y-3">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Últimos 60 dias</h2>
        {loading ? (
          <p className="text-sm text-zinc-400">Carregando...</p>
        ) : notices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-400">
            Nenhum recado ainda.
          </div>
        ) : (
          notices.map((n) => {
            const readIds = new Set(n.readBy.map((r) => r.barberId));
            const pending = team.filter((m) => !readIds.has(m.id));
            const allRead = team.length > 0 && pending.length === 0;
            return (
              <div key={n.id} className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-400">
                      {n.authorName ?? "Dono"} · {whenLabel(n.createdAt)}
                    </p>
                    <p className="text-sm text-zinc-800 mt-1 whitespace-pre-line">{n.content}</p>
                  </div>
                  <button
                    onClick={() => setToDelete(n)}
                    className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    title="Apagar recado"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="pt-3 border-t border-zinc-100 text-xs space-y-1">
                  <p className={`font-semibold flex items-center gap-1.5 ${allRead ? "text-green-700" : "text-zinc-600"}`}>
                    <CheckCheck className="w-4 h-4" />
                    {allRead ? "Toda a equipe leu" : `Lido por ${n.readBy.length} de ${team.length}`}
                  </p>
                  {n.readBy.length > 0 && (
                    <p className="text-zinc-500">Leram: {n.readBy.map((r) => r.name.split(" ")[0]).join(", ")}</p>
                  )}
                  {!allRead && pending.length > 0 && (
                    <p className="text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Ainda não leram: {pending.map((m) => m.name.split(" ")[0]).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmDialog
        isOpen={!!toDelete}
        title="Apagar recado?"
        message="O recado some também para a equipe."
        type="danger"
        confirmLabel="Apagar"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
