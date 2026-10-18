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
    <section className="bg-surface rounded-2xl border border-line p-5 flex flex-col gap-3" aria-label="Recados da barbearia">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-ink-3" aria-hidden /> Recados da barbearia
        </h2>
        {unread > 0 && (
          <span className="h-[22px] px-2 rounded-full bg-primary text-white text-[11px] font-semibold inline-flex items-center">
            {unread} {unread === 1 ? "novo" : "novos"}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((n) => (
          <li key={n.id} className={`rounded-xl p-3.5 flex flex-col gap-1.5 ${n.read ? "border border-line-2" : "bg-ground"}`}>
            <p className="text-xs text-ink-3 flex justify-between gap-2">
              <span className="font-semibold text-ink">{n.authorName ?? "Dono"}</span><span>{whenLabel(n.createdAt)}</span>
            </p>
            <p className={`text-sm leading-snug whitespace-pre-line ${n.read ? "text-ink-2" : "text-ink"}`}>{n.content}</p>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2">
        {notices.length > 3 ? (
          <button onClick={() => setShowAll((v) => !v)} className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">
            {showAll ? "Mostrar menos" : `Ver todos (${notices.length})`}
          </button>
        ) : <span />}
        {unread > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-positive disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" /> {marking ? "..." : "Marcar como lidos"}
          </button>
        )}
      </div>
    </section>
  );
}
