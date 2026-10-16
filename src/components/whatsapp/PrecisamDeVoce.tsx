"use client";
import { useCallback, useEffect, useState } from "react";
import { HandHelping, MessageCircle, Bot } from "lucide-react";
import { useAuthStore } from "@/store/auth";

interface Contact {
  id: string;
  phone: string | null;
  name: string | null;
  handoffAt: string | null;
  handoffReason: string | null;
  aiPausedUntil: string;
  lastMessage: { textContent: string | null; timestamp: string } | null;
}

function ago(iso: string | null) {
  if (!iso) return "";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h}h` : new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Conversas que a IA passou para a barbearia ("precisam de você"). Enquanto estão aqui,
 * a IA não responde esse cliente; "Devolver para a IA" libera de novo.
 */
export default function PrecisamDeVoce() {
  const { token } = useAuthStore();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await fetch("/api/barbershop/whatsapp/atendimento", { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { setContacts([]); return; }
    const d = await r.json();
    setContacts(d.contacts ?? []);
  }, [token]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // a IA pode passar conversas a qualquer momento
    return () => clearInterval(t);
  }, [load]);

  async function release(id: string) {
    setBusy(id);
    await fetch("/api/barbershop/whatsapp/atendimento", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ contactId: id, action: "release" }),
    });
    setBusy(null);
    setContacts((cur) => (cur ?? []).filter((c) => c.id !== id));
  }

  if (contacts === null) return null;

  return (
    <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 mb-6" aria-label="Precisam de você">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
          <HandHelping className="w-5 h-5 text-primary" /> Precisam de você
        </h2>
        {contacts.length > 0 && (
          <span className="text-xs font-bold text-white bg-primary rounded-full px-2 py-0.5">{contacts.length}</span>
        )}
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nenhuma conversa esperando. Quando a IA não souber resolver (pedido de desconto, reclamação, pedido para falar com alguém),
          a conversa aparece aqui e a IA para de responder esse cliente.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {contacts.map((c) => {
            const digits = (c.phone ?? "").replace(/\D/g, "");
            const wa = digits ? `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}` : null;
            return (
              <li key={c.id} className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">
                    {c.name ?? c.phone ?? "Cliente"} <span className="font-normal text-zinc-400">· {ago(c.handoffAt)}</span>
                  </p>
                  {c.handoffReason && <p className="text-xs text-amber-700 mt-0.5">{c.handoffReason}</p>}
                  {c.lastMessage?.textContent && (
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">“{c.lastMessage.textContent}”</p>
                  )}
                  <p className="text-[11px] text-zinc-400 mt-1">
                    IA pausada para este cliente até {new Date(c.aiPausedUntil).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600">
                      <MessageCircle className="w-3.5 h-3.5" /> Responder
                    </a>
                  )}
                  <button onClick={() => release(c.id)} disabled={busy === c.id}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
                    <Bot className="w-3.5 h-3.5" /> {busy === c.id ? "..." : "Devolver para a IA"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
