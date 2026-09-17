"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import type { TodayAppointment } from "./dashboard-types";

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: "Confirmado", className: "bg-positive-soft text-positive" },
  PENDING: { label: "Sem confirmação", className: "bg-warning-soft text-warning" },
};

function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function TodayAgenda({ appointments, nowHour }: { appointments: TodayAppointment[]; nowHour: number }) {
  const [barberId, setBarberId] = useState<string>("all");

  const barbers = useMemo(() => {
    const map = new Map<string, string>();
    appointments.forEach((a) => map.set(a.barber.id, a.barber.user.name));
    return Array.from(map, ([id, name]) => ({ id, name: name.split(" ")[0] }));
  }, [appointments]);

  const doneEarlier = appointments.filter((a) => a.status === "DONE").length;
  const nowMinutes = nowHour * 60 + new Date().getMinutes();
  const upcoming = appointments.filter(
    (a) => (a.status === "CONFIRMED" || a.status === "PENDING") && (barberId === "all" || a.barber.id === barberId)
  );
  const nextId = upcoming.find((a) => minutesOf(a.startTime) >= nowMinutes)?.id;

  return (
    <section aria-labelledby="agenda-title" className="bg-white border border-line rounded-2xl flex flex-col">
      <div className="flex items-center justify-between px-5 pt-[18px] pb-3">
        <h2 id="agenda-title" className="text-[15px] font-semibold text-ink">Próximos horários</h2>
        <Link href="/painel/agendamentos" className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">
          Abrir agenda
        </Link>
      </div>

      {barbers.length > 1 && (
        <div role="group" aria-label="Filtrar por profissional" className="flex flex-wrap gap-1.5 px-5 pb-3.5">
          {[{ id: "all", name: "Todos" }, ...barbers].map((b) => {
            const on = barberId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={on}
                onClick={() => setBarberId(b.id)}
                className={`h-[30px] px-3 rounded-full border text-xs font-semibold transition-colors ${
                  on ? "bg-ink border-ink text-white" : "bg-white border-line text-ink-2 hover:bg-ground"
                }`}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      )}

      {upcoming.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink-3 border-t border-line-3">
          <Calendar className="w-8 h-8 text-bar-soft" />
          <p className="text-sm">Nenhum horário pela frente hoje</p>
        </div>
      ) : (
        <ul className="max-h-[520px] overflow-y-auto">
          {upcoming.map((a) => {
            const isNext = a.id === nextId;
            const chip = STATUS_CHIP[a.status];
            return (
              <li
                key={a.id}
                className={`flex items-center gap-3.5 px-5 py-3 border-t border-line-3 ${isNext ? "bg-primary/10" : ""}`}
              >
                <span className={`w-11 text-sm font-bold tabular-nums ${isNext ? "text-primary" : "text-ink"}`}>{a.startTime}</span>
                <div className="flex-1 min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink truncate">
                    {a.client?.name || "Cliente"}
                    {a.noshowRisk && a.noshowRisk.label !== "low" && (
                      <span
                        title={`Risco de falta: ${a.noshowRisk.score}% (${a.noshowRisk.noShowCount} de ${a.noshowRisk.totalCount})`}
                        className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          a.noshowRisk.label === "high" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"
                        }`}
                      >
                        {a.noshowRisk.label === "high" ? "costuma faltar" : "já faltou"}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-3 truncate">
                    {a.service?.name || "Serviço"} · {a.barber.user.name.split(" ")[0]}
                    {a.subscription ? " · assinante" : ""}
                  </p>
                </div>
                {isNext ? (
                  <span className="h-6 px-2 rounded-full bg-primary text-white text-[11px] font-semibold flex items-center shrink-0">
                    Próximo
                  </span>
                ) : (
                  chip && (
                    <span className={`h-6 px-2 rounded-full text-[11px] font-semibold flex items-center whitespace-nowrap shrink-0 ${chip.className}`}>
                      {chip.label}
                    </span>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}

      {doneEarlier > 0 && (
        <Link
          href="/painel/agendamentos"
          className="flex items-center justify-center h-12 border-t border-line-2 text-[13px] font-semibold text-ink-2 hover:bg-ground rounded-b-2xl"
        >
          Ver os {doneEarlier} atendimento{doneEarlier !== 1 ? "s" : ""} de mais cedo
        </Link>
      )}
    </section>
  );
}
