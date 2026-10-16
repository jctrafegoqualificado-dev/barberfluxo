"use client";
import { useEffect, useState } from "react";
import { Megaphone, CheckCheck } from "lucide-react";
import { useAuthStore } from "@/store/auth";

interface Notice { id: string; content: string; authorName: string | null; createdAt: string; read: boolean }

function whenLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  if (d.toDateString() === yesterday.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** "Recados da barbearia" no início do barbeiro. Some quando não há recado nos últimos 30 dias. */
export default function RecadosEquipeCard() {
  const { token } = useAuthStore();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch("/api/barbershop/recados", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { notices: [] }))
      .then((d) => setNotices(d.notices ?? []))
      .catch(() => {});
  }, [token]);

  if (notices.length === 0) return null;

  const unread = notices.filter((n) => !n.read).length;
  const visible = showAll ? notices : notices.slice(0, 3);

  async function markAllRead() {
    setMarking(true);
    const r = await fetch("/api/barbershop/recados/lidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: notices.filter((n) => !n.read).map((n) => n.id) }),
    });
    setMarking(false);
    if (r.ok) setNotices((cur) => cur.map((n) => ({ ...n, read: true })));
  }

  return (
    <section className="bg-white rounded-xl border border-zinc-100 shadow-sm p-4 space-y-3" aria-label="Recados da barbearia">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" /> Recados da barbearia
        </h2>
        {unread > 0 && (
          <span className="text-xs font-bold text-white bg-primary rounded-full px-2 py-0.5">
            {unread} {unread === 1 ? "novo" : "novos"}
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {visible.map((n) => (
          <li key={n.id} className={`rounded-lg p-3 text-sm ${n.read ? "bg-zinc-50" : "bg-primary/5 border border-primary/20"}`}>
            <p className="text-xs text-zinc-400">
              {n.authorName ?? "Dono"} · {whenLabel(n.createdAt)}
            </p>
            <p className="text-zinc-800 mt-0.5 whitespace-pre-line">{n.content}</p>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2">
        {notices.length > 3 ? (
          <button onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800">
            {showAll ? "Mostrar menos" : `Ver todos (${notices.length})`}
          </button>
        ) : <span />}
        {unread > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" /> {marking ? "..." : "Marcar como lidos"}
          </button>
        )}
      </div>
    </section>
  );
}
