"use client";
import { useCallback, useEffect, useState } from "react";
import { BellRing, X, MessageCircle, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";

interface Entry {
  id: string;
  clientName: string;
  clientPhone: string;
  anyBarber: boolean;
  status: "WAITING" | "NOTIFIED" | "BOOKED";
  notifiedAt: string | null;
  notifiedSlot: string | null;
  barber: { id: string; user: { name: string } } | null;
}

const STATUS: Record<Entry["status"], { label: string; cls: string }> = {
  WAITING:  { label: "Aguardando", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  NOTIFIED: { label: "Avisado",    cls: "bg-blue-50 text-blue-700 border-blue-200" },
  BOOKED:   { label: "Agendou",    cls: "bg-green-50 text-green-700 border-green-200" },
};

/** Botão "Lista de espera (N)" da agenda do painel + janela com a fila do dia. */
export default function WaitlistPanelButton({ date, shopName }: { date: string; shopName?: string }) {
  const { token } = useAuthStore();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/barbershop/lista-espera?date=${date}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const d = await r.json();
    setEntries(d.entries ?? []);
  }, [token, date]);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    setEntries((cur) => cur.filter((e) => e.id !== id));
    await fetch(`/api/barbershop/lista-espera?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  }

  const waiting = entries.filter((e) => e.status !== "BOOKED").length;
  if (entries.length === 0) return null;

  const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <>
      <button
        onClick={() => { setOpen(true); load(); }}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100 transition-colors"
      >
        <BellRing className="w-4 h-4" /> Lista de espera{waiting > 0 ? ` (${waiting})` : ""}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" role="dialog" aria-label="Lista de espera">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <div>
                <p className="font-bold text-zinc-900">Lista de espera · {dayLabel}</p>
                <p className="text-xs text-zinc-500">Quando alguém cancela, os primeiros da fila são avisados no WhatsApp.</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="divide-y divide-zinc-100 max-h-[60vh] overflow-y-auto">
              {entries.map((e, i) => {
                const st = STATUS[e.status];
                const msg = encodeURIComponent(`Olá ${e.clientName.split(" ")[0]}! Aqui é da ${shopName ?? "barbearia"}. Abriu um horário no dia ${dayLabel}, quer agendar?`);
                const phone = e.clientPhone.startsWith("55") ? e.clientPhone : `55${e.clientPhone}`;
                return (
                  <li key={e.id} className="px-5 py-3 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-zinc-100 text-zinc-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-zinc-900">{e.clientName}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {e.anyBarber ? "Qualquer profissional" : `Com ${e.barber?.user.name.split(" ")[0] ?? "—"}`}
                        {e.status === "NOTIFIED" && e.notifiedSlot ? ` · avisado da vaga ${e.notifiedSlot}` : ""}
                      </p>
                    </div>
                    {e.status !== "BOOKED" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`https://wa.me/${phone}?text=${msg}`} target="_blank" rel="noreferrer"
                          className="p-2 rounded-lg text-green-600 hover:bg-green-50" title="Chamar no WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                        <button onClick={() => remove(e.id)} className="p-2 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50" title="Tirar da fila">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
