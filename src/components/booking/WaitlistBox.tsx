"use client";
import { useState } from "react";
import { BellRing, Check } from "lucide-react";

/**
 * "Não achou horário? Entre na lista de espera" — etapa de horário do link de agendamento.
 * Se alguém cancelar naquele dia, o cliente recebe um WhatsApp com o link (src/lib/waitlist.ts).
 */
export default function WaitlistBox({
  slug, barberId, barberName, serviceIds, days, defaultDate, dayLabel,
}: {
  slug: string;
  barberId: string;
  barberName: string;
  serviceIds: string[];
  days: { date: string; full: boolean }[];
  defaultDate: string;
  dayLabel: (date: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate || days[0]?.date || "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [anyBarber, setAnyBarber] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const r = await fetch(`/api/booking/${slug}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientName: name, clientPhone: phone, date, barberId, anyBarber, serviceIds }),
    });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setError(d.error ?? "Não foi possível entrar na lista. Tente de novo."); return; }
    setDone(date);
  }

  if (done) {
    return (
      <div className="bg-zinc-900 rounded-2xl border border-green-900/60 p-4 flex gap-3" role="status">
        <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-white">Você está na lista de espera de {dayLabel(done).toLowerCase()}.</p>
          <p className="text-zinc-400 mt-0.5">Se abrir uma vaga, avisamos no seu WhatsApp. Quem agendar primeiro leva o horário.</p>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex items-center gap-3 text-left hover:border-zinc-600 transition-colors"
      >
        <BellRing className="w-5 h-5 text-primary shrink-0" />
        <span className="text-sm">
          <span className="font-semibold text-white">Não achou horário?</span>{" "}
          <span className="text-zinc-400">Entre na lista de espera e avisamos se abrir uma vaga.</span>
        </span>
      </button>
    );
  }

  const inputCls = "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-primary";

  return (
    <form onSubmit={submit} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-3">
      <p className="font-semibold text-sm flex items-center gap-2">
        <BellRing className="w-4 h-4 text-primary" /> Lista de espera
      </p>

      <div>
        <label htmlFor="wl-date" className="block text-xs text-zinc-400 mb-1">Qual dia?</label>
        <select id="wl-date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls}>
          {days.map((d) => (
            <option key={d.date} value={d.date}>{dayLabel(d.date)}{d.full ? " · lotado" : ""}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="wl-name" className="block text-xs text-zinc-400 mb-1">Seu nome</label>
          <input id="wl-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoComplete="name" required />
        </div>
        <div>
          <label htmlFor="wl-phone" className="block text-xs text-zinc-400 mb-1">WhatsApp com DDD</label>
          <input
            id="wl-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls}
            inputMode="tel" autoComplete="tel" placeholder="(41) 99999-9999" required
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
        <input type="checkbox" checked={anyBarber} onChange={(e) => setAnyBarber(e.target.checked)} className="w-4 h-4 accent-[var(--color-primary)]" />
        Pode ser com outro profissional, não só {barberName}
      </label>

      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800">
          Voltar
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim() || phone.replace(/\D/g, "").length < 10}
          className="flex-[1.5] py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-40"
        >
          {saving ? "Enviando..." : "Me avise se abrir vaga"}
        </button>
      </div>
    </form>
  );
}
