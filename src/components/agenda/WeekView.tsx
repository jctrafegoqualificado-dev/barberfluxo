"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { cn, getInitials } from "@/lib/utils";
import type { Appointment, Barber } from "./types";

/**
 * Visão Semana da agenda: segunda a domingo da semana de `date`, horários de todos os
 * profissionais (ou de um só). Clicar num horário ou no dia abre a visão Dia naquele dia.
 */

const HOUR_PX = 48;
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
// Cores dos profissionais (borda à esquerda do horário)
const PALETTE = ["#C94F0C", "#1F4E8C", "#2F6B4F", "#7A3EA0", "#A16207", "#0E7490", "#9B2C22", "#57524A"];
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const addDays = (key: string, n: number) => { const d = new Date(key + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mondayOf = (key: string) => addDays(key, -((new Date(key + "T12:00:00Z").getUTCDay() + 6) % 7));
const STATUS_CLS: Record<string, string> = {
  DONE: "bg-surface-3 text-ink-2",
  CONFIRMED: "bg-surface border border-[#B9B0A1]",
  PENDING: "bg-[#FFF8E8] border border-dashed border-[#B08A2E]",
  NO_SHOW: "bg-danger-soft border border-[#E3A59D] text-danger",
};

/** Distribui horários que se sobrepõem lado a lado dentro do dia. */
function lanes(list: Appointment[]) {
  const sorted = [...list].sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  const out: { a: Appointment; lane: number; of: number }[] = [];
  let group: { a: Appointment; lane: number }[] = [];
  let groupEnd = -1;
  const flush = () => { const of = Math.max(1, ...group.map((g) => g.lane + 1)); group.forEach((g) => out.push({ ...g, of })); group = []; };
  for (const a of sorted) {
    const s = toMin(a.startTime), e = toMin(a.endTime);
    if (s >= groupEnd && group.length) flush();
    const laneEnds: number[] = [];
    group.forEach((g) => { laneEnds[g.lane] = Math.max(laneEnds[g.lane] ?? 0, toMin(g.a.endTime)); });
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) lane = laneEnds.length;
    group.push({ a, lane });
    groupEnd = Math.max(groupEnd, e);
  }
  if (group.length) flush();
  return out;
}

export default function WeekView({ date, today, barbers, onOpen, reloadKey }: {
  date: string; today: string; barbers: Barber[]; reloadKey: number;
  onOpen: (day: string, appointmentId?: string) => void;
}) {
  const { token } = useAuthStore();
  const monday = mondayOf(date);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [only, setOnly] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    fetch(`/api/barbershop/appointments?from=${days[0]}&to=${days[6]}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { appointments: [] }))
      .then((d) => { if (alive) setAppts((d.appointments ?? []).filter((a: Appointment) => a.status !== "CANCELLED")); })
      .catch(() => { if (alive) setAppts([]); });
    return () => { alive = false; };
  }, [token, days, reloadKey]);

  const color = useMemo(() => new Map(barbers.map((b, i) => [b.id, PALETTE[i % PALETTE.length]])), [barbers]);
  const visible = (appts ?? []).filter((a) => only === "all" || a.barber.id === only);
  const startH = Math.min(8, ...visible.map((a) => Math.floor(toMin(a.startTime) / 60)));
  const endH = Math.max(20, ...visible.map((a) => Math.ceil(toMin(a.endTime) / 60)));
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const byDay = (k: string) => visible.filter((a) => a.date.slice(0, 10) === k);

  return (
    <section aria-label="Semana" className="flex-1 min-w-0 bg-surface border border-line rounded-2xl flex flex-col overflow-hidden">
      {barbers.length > 1 && (
        <div role="group" aria-label="Profissional" className="flex gap-2 flex-wrap px-4 py-3 border-b border-line-2">
          {[{ id: "all", name: "Todos" }, ...barbers.map((b) => ({ id: b.id, name: b.nickname || b.user.name.split(" ")[0] }))].map((b) => (
            <button key={b.id} type="button" aria-pressed={only === b.id} onClick={() => setOnly(b.id)}
              className={cn("h-8 px-3 rounded-full border text-[13px] font-semibold flex items-center gap-1.5", only === b.id ? "bg-ink text-white border-ink" : "bg-surface border-control")}>
              {b.id !== "all" && <span className="w-2 h-2 rounded-full" style={{ background: color.get(b.id) }} />}{b.name}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-auto flex-1">
        <div className="min-w-[760px]">
          <div className="grid sticky top-0 z-10 bg-surface border-b border-line-2" style={{ gridTemplateColumns: "52px repeat(7, minmax(0, 1fr))" }}>
            <span />
            {days.map((k) => {
              const n = byDay(k).length;
              return (
                <button key={k} type="button" onClick={() => onOpen(k)} aria-label={`Abrir ${k}`}
                  className={cn("flex flex-col items-center py-2.5 border-l border-line-2 hover:bg-ground", k === date && "bg-ground")}>
                  <span className="text-xs text-ink-3">{DOW[new Date(k + "T12:00:00Z").getUTCDay()]}</span>
                  <span className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[15px] font-bold", k === today ? "bg-primary text-white" : "text-ink")}>{Number(k.slice(8))}</span>
                  <span className="text-[11px] text-ink-3">{appts ? `${n} ${n === 1 ? "horário" : "horários"}` : "…"}</span>
                </button>
              );
            })}
          </div>
          <div className="grid relative pt-2" style={{ gridTemplateColumns: "52px repeat(7, minmax(0, 1fr))" }}>
            <div>
              {hours.map((h) => (
                <div key={h} className="text-[11px] text-ink-3 text-right pr-2 -translate-y-1.5" style={{ height: HOUR_PX }}>{String(h).padStart(2, "0")}:00</div>
              ))}
            </div>
            {days.map((k) => (
              <div key={k} className={cn("relative border-l border-line-2", k === today && "bg-primary/[0.03]")} style={{ height: hours.length * HOUR_PX }}>
                {hours.map((h) => <div key={h} className="border-t border-line-2" style={{ height: HOUR_PX }} />)}
                {lanes(byDay(k)).map(({ a, lane, of }) => {
                  const top = ((toMin(a.startTime) - startH * 60) / 60) * HOUR_PX;
                  const height = Math.max(18, ((toMin(a.endTime) - toMin(a.startTime)) / 60) * HOUR_PX - 2);
                  return (
                    <button key={a.id} type="button" onClick={() => onOpen(k, a.id)}
                      title={`${a.startTime} · ${a.client.name} · ${a.barber.nickname || a.barber.user.name}`}
                      className={cn("absolute rounded-md px-1.5 py-0.5 text-left overflow-hidden text-[11px] leading-tight hover:z-20 hover:shadow-md", STATUS_CLS[a.status] ?? STATUS_CLS.CONFIRMED)}
                      style={{ top, height, left: `calc(${(lane / of) * 100}% + 2px)`, width: `calc(${100 / of}% - 4px)`, borderLeft: `3px solid ${color.get(a.barber.id) ?? "#57524A"}` }}>
                      <span className="font-semibold block">{a.startTime}</span>
                      {height > 30 && <span className="block truncate">{a.client.name.split(" ")[0]}</span>}
                      {height > 44 && of === 1 && <span className="block truncate text-ink-3">{getInitials(a.barber.nickname || a.barber.user.name)}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {appts && visible.length === 0 && <p className="px-4 py-3 text-[13px] text-ink-3 border-t border-line-2">Nenhum horário nesta semana{only !== "all" ? " para este profissional" : ""}.</p>}
    </section>
  );
}
