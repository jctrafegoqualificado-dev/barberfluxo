"use client";
import { useState } from "react";
import { ChevronDown, MessageCircle, Lock } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Chip } from "@/components/ui/Chip";
import {
  type Appointment, type Barber, type Bloqueio, servicesLabel, barberShortName, toMin, isOpenStatus,
  nowMinutesSP, STATUS_NOTE, whatsappLink,
} from "./types";

/**
 * Agenda no celular (docs/design/Agenda-celular.dc.html): lista do dia por horário,
 * com filtro por profissional, "AGORA", o próximo cliente em destaque e o que já passou recolhido.
 */
export default function AgendaMobile({
  appointments, bloqueios, barbers, isToday, onSelect, onConclude, onToggleArrived,
}: {
  appointments: Appointment[];
  bloqueios: Bloqueio[];
  barbers: Barber[];
  isToday: boolean;
  onSelect: (a: Appointment) => void;
  onConclude: (a: Appointment) => void;
  onToggleArrived: (a: Appointment) => void;
}) {
  const [barberId, setBarberId] = useState<string>("all");
  const [showPast, setShowPast] = useState(false);
  const now = nowMinutesSP();

  const list = appointments
    .filter((a) => a.status !== "CANCELLED")
    .filter((a) => barberId === "all" || a.barber.id === barberId)
    .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));

  const done = list.filter((a) => a.status === "DONE" || a.status === "NO_SHOW");
  const open = list.filter((a) => isOpenStatus(a.status));
  // Hoje: o "próximo" é o primeiro em aberto que ainda não terminou.
  const next = isToday ? open.find((a) => toMin(a.endTime) > now) : undefined;
  const late = isToday ? open.filter((a) => a !== next && toMin(a.endTime) <= now) : [];
  const upcoming = open.filter((a) => a !== next && !late.includes(a));
  const pending = open.filter((a) => a.status === "PENDING" && a.confirmedVia !== "WHATSAPP").length;
  const blocks = bloqueios.filter((b) => barberId === "all" || b.barber.id === barberId);

  return (
    <div className="flex flex-col gap-3.5">
      {barbers.length > 1 && (
        <div role="group" aria-label="Filtrar por profissional" className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5">
          <Chip active={barberId === "all"} onClick={() => setBarberId("all")} className="shrink-0">Todos</Chip>
          {barbers.map((b) => (
            <Chip key={b.id} active={barberId === b.id} onClick={() => setBarberId(b.id)} className="shrink-0">
              {barberShortName(b)}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-surface border border-line text-[13px] text-ink-2">
        <span>
          <strong className="text-ink">{list.length}</strong> no dia · <strong className="text-ink">{open.length}</strong> a atender
          {list.some((a) => a.status === "NO_SHOW") && <> · <strong className="text-ink">{list.filter((a) => a.status === "NO_SHOW").length}</strong> falta</>}
        </span>
        {pending > 0 && <span className="font-semibold text-warning shrink-0">{pending} sem confirmação</span>}
      </div>

      {done.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}
            className="w-full flex items-center justify-between h-11 px-3.5 rounded-xl bg-[#EDE9E1] text-ink-2 text-[13px] font-semibold">
            <span>{done.length} {done.length === 1 ? "atendimento" : "atendimentos"} {isToday ? "mais cedo" : "encerrados"}</span>
            <ChevronDown className={cn("w-4 h-4 transition-transform", showPast && "rotate-180")} aria-hidden />
          </button>
          {showPast && <List items={done} onSelect={onSelect} className="mt-2" />}
        </div>
      )}

      {/* Atrasados aconteceram antes de agora: ficam acima da linha */}
      {late.length > 0 && <List items={late} onSelect={onSelect} lateNote />}

      {isToday && (
        <div className="flex items-center gap-2 text-xs font-bold text-primary" aria-hidden>
          <span className="h-0.5 w-3.5 bg-primary" />AGORA · {String(Math.floor(now / 60)).padStart(2, "0")}:{String(now % 60).padStart(2, "0")}
          <span className="h-0.5 flex-1 bg-primary" />
        </div>
      )}

      {next && (
        <section aria-label="Próximo atendimento" className="bg-surface border-2 border-primary rounded-[14px] p-3.5 flex flex-col gap-2.5">
          <button type="button" onClick={() => onSelect(next)} className="flex items-start gap-3 text-left">
            <span className="w-12 flex flex-col shrink-0">
              <span className="text-base font-bold">{next.startTime}</span>
              <span className="text-xs text-ink-3">{toMin(next.endTime) - toMin(next.startTime)} min</span>
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-base font-semibold truncate">{next.client.name}</span>
              <span className="text-[13px] text-ink-2 truncate">{servicesLabel(next)} · {barberShortName(next.barber)} · {formatCurrency(next.price)}</span>
              {next.confirmedVia === "WHATSAPP" && <span className="text-xs font-semibold text-positive">Confirmado pelo WhatsApp</span>}
              {next.arrivedAt && <span className="text-xs font-semibold text-positive">Já chegou</span>}
            </span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onToggleArrived(next)}
              className={cn("h-11 rounded-[10px] border text-sm font-semibold",
                next.arrivedAt ? "bg-positive-soft border-positive/30 text-positive" : "bg-surface border-control text-ink")}>
              {next.arrivedAt ? "Chegou ✓" : "Chegou"}
            </button>
            <button type="button" onClick={() => onConclude(next)} className="h-11 rounded-[10px] bg-primary text-white text-sm font-semibold">
              Concluir e cobrar
            </button>
          </div>
        </section>
      )}

      {upcoming.length > 0 && <List items={upcoming} onSelect={onSelect} />}

      {blocks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-control bg-[repeating-linear-gradient(135deg,#F7F5F0_0,#F7F5F0_6px,#EBE6DC_6px,#EBE6DC_12px)] text-[13px] text-ink-2">
              <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden />
              <span className="font-semibold">{b.startTime} – {b.endTime}</span>
              <span className="truncate">{b.reason || "Bloqueado"} · {b.barber.user.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      )}

      {list.length === 0 && (
        <div className="bg-surface border border-line rounded-[14px] p-8 text-center text-sm text-ink-3">Nenhum horário neste dia.</div>
      )}
    </div>
  );
}

function List({ items, onSelect, className, lateNote }: {
  items: Appointment[]; onSelect: (a: Appointment) => void; className?: string; lateNote?: boolean;
}) {
  return (
    <ul className={cn("bg-surface border border-line rounded-[14px] overflow-hidden divide-y divide-line-3", className)}>
      {items.map((a) => {
        const pending = a.status === "PENDING" && a.confirmedVia !== "WHATSAPP";
        const closed = a.status === "DONE" || a.status === "NO_SHOW";
        const wa = pending
          ? whatsappLink(a.client.phone, `Olá ${a.client.name.split(" ")[0]}! Confirmando seu horário de hoje às ${a.startTime}. Podemos confirmar?`)
          : null;
        return (
          <li key={a.id} className="flex items-center gap-3 px-3.5 py-3">
            <button type="button" onClick={() => onSelect(a)} className="flex flex-1 min-w-0 items-center gap-3 text-left">
              <span className="w-12 flex flex-col shrink-0">
                <span className={cn("text-[15px] font-bold", closed ? "text-ink-3" : "text-ink")}>{a.startTime}</span>
                <span className="text-[11px] text-ink-3">{toMin(a.endTime) - toMin(a.startTime)} min</span>
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className={cn("text-[15px] font-semibold truncate", a.status === "NO_SHOW" ? "text-danger line-through" : closed ? "text-ink-2" : "text-ink")}>
                  {a.client.name}
                </span>
                <span className="text-xs text-ink-3 truncate">
                  {servicesLabel(a)} · {barberShortName(a.barber)}{closed ? ` · ${STATUS_NOTE[a.status]}` : ""}
                </span>
                {a.arrivedAt && !closed && <span className="text-xs font-semibold text-positive">Chegou · em atendimento</span>}
                {lateNote && !a.arrivedAt && <span className="text-xs font-semibold text-danger">Passou do horário</span>}
                {pending && !lateNote && <span className="text-xs font-semibold text-warning">Sem confirmação</span>}
                {a.confirmedVia === "WHATSAPP" && !closed && <span className="text-xs font-semibold text-positive">Confirmou no WhatsApp</span>}
              </span>
            </button>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" aria-label={`Pedir confirmação para ${a.client.name} pelo WhatsApp`}
                className="w-11 h-11 shrink-0 rounded-[10px] border border-dashed border-[#B08A2E] bg-[#FFF8E8] text-warning inline-flex items-center justify-center">
                <MessageCircle className="w-[18px] h-[18px]" aria-hidden />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
