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
      <div className="bg-positive-soft rounded-[14px] border border-[#BFDFCB] p-4 flex gap-3" role="status">
        <Check className="w-5 h-5 text-positive shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-positive">Você está na lista de espera de {dayLabel(done).toLowerCase()}.</p>
          <p className="text-positive mt-0.5">Se abrir uma vaga, avisamos no seu WhatsApp. Quem agendar primeiro leva o horário.</p>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-surface rounded-xl border border-dashed border-[#D8D0C2] px-3.5 py-3 flex items-center gap-3 text-left hover:border-ink-4 transition-colors"
      >
        <BellRing className="w-5 h-5 text-primary shrink-0" />
        <span className="text-sm">
          <span className="font-semibold text-ink">Não achou horário?</span>{" "}
          <span className="text-ink-2">Entre na lista de espera e avisamos se abrir uma vaga.</span>
        </span>
      </button>
    );
  }

  const inputCls = "w-full h-12 bg-surface border border-[#D8D0C2] rounded-xl px-3.5 text-base text-ink placeholder:text-ink-4 outline-none focus:border-ink";

  return (
    <form onSubmit={submit} className="bg-surface rounded-[14px] border border-line p-4 space-y-3">
      <p className="font-semibold text-sm flex items-center gap-2">
        <BellRing className="w-4 h-4 text-primary" /> Lista de espera
      </p>

      <div>
        <label htmlFor="wl-date" className="block text-[13px] font-semibold text-ink-2 mb-1">Qual dia?</label>
        <select id="wl-date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls}>
          {days.map((d) => (
            <option key={d.date} value={d.date}>{dayLabel(d.date)}{d.full ? " · lotado" : ""}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="wl-name" className="block text-[13px] font-semibold text-ink-2 mb-1">Seu nome</label>
          <input id="wl-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoComplete="name" required />
        </div>
        <div>
          <label htmlFor="wl-phone" className="block text-[13px] font-semibold text-ink-2 mb-1">WhatsApp com DDD</label>
          <input
            id="wl-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls}
            inputMode="tel" autoComplete="tel" placeholder="(41) 99999-9999" required
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
        <input type="checkbox" checked={anyBarber} onChange={(e) => setAnyBarber(e.target.checked)} className="w-4 h-4 accent-[var(--color-primary)]" />
        Pode ser com outro profissional, não só {barberName}
      </label>

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 h-12 rounded-xl border border-control bg-surface text-ink text-sm font-semibold hover:bg-surface-3">
          Voltar
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim() || phone.replace(/\D/g, "").length < 10}
          className="flex-[1.5] h-12 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-40"
        >
          {saving ? "Enviando..." : "Me avise se abrir vaga"}
        </button>
      </div>
    </form>
  );
}
