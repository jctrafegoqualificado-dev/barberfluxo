"use client";
import { useEffect, useState } from "react";
import { X, Clock, User, Scissors, StickyNote, HandCoins, CreditCard } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, cn } from "@/lib/utils";
import { Pill } from "@/components/ui/Badge";
import {
  type Appointment, getInitials, servicesLabel, isOpenStatus,
  localDateStr, nowMinutesSP, toMin, whatsappLink,
} from "./types";

interface Resumo {
  visits: number;
  lastVisit: string | null;
  recent: { date: string; services: string; barberName: string }[];
  note: string | null;
}

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).replace(".", "");

function daysSince(iso: string) {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`;
}

/** Quanto falta para começar (só hoje, só horários futuros). */
function startsIn(appt: Appointment) {
  if (appt.date.slice(0, 10) !== localDateStr() || !isOpenStatus(appt.status)) return null;
  const diff = toMin(appt.startTime) - nowMinutesSP();
  if (diff < 0 || diff > 180) return null;
  return diff === 0 ? "agora" : diff < 60 ? `em ${diff} min` : `em ${Math.floor(diff / 60)}h${String(diff % 60).padStart(2, "0")}`;
}

/**
 * Detalhes do horário selecionado na agenda (docs/design/Agenda-desktop.dc.html, painel direito):
 * cliente, horário, profissional, serviços, observação, últimas visitas e ações.
 */
export default function AppointmentDetails({
  appt, onClose, onConclude, onToggleArrived, onStatus, onReopen, onDelete,
}: {
  appt: Appointment | null;
  onClose?: () => void;
  onConclude: (a: Appointment) => void;
  onToggleArrived: (a: Appointment) => void;
  onStatus: (a: Appointment, status: "NO_SHOW" | "CANCELLED") => void;
  onReopen: (a: Appointment) => void;
  onDelete: (a: Appointment) => void;
}) {
  const { token } = useAuthStore();
  const [resumo, setResumo] = useState<{ id: string; data: Resumo } | null>(null);
  const clientId = appt?.client.id;

  useEffect(() => {
    if (!clientId || !token) return;
    let alive = true;
    fetch(`/api/barbershop/clientes/${clientId}/resumo`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setResumo({ id: clientId, data: d }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [clientId, token]);

  if (!appt) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-2">
        <Clock className="w-8 h-8 text-ink-4" aria-hidden />
        <p className="text-sm font-semibold text-ink">Nenhum horário selecionado</p>
        <p className="text-[13px] text-ink-3">Toque num horário da agenda para ver o cliente e as ações.</p>
      </div>
    );
  }

  const r = resumo && resumo.id === clientId ? resumo.data : null;
  const day = appt.date.slice(0, 10);
  const isToday = day === localDateStr();
  const when = isToday ? "hoje" : new Date(day + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const soon = startsIn(appt);
  const open = isOpenStatus(appt.status);
  const note = r?.note || appt.notes;
  const wa = whatsappLink(appt.client.phone, `Olá ${appt.client.name.split(" ")[0]}! `);

  return (
    <div className="flex flex-col h-full">
      {/* Cliente */}
      <div className="flex items-start justify-between gap-2.5 px-5 pt-[18px] pb-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-primary/10 text-primary text-[15px] font-bold flex items-center justify-center shrink-0">
            {getInitials(appt.client.name)}
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-ink truncate">{appt.client.name}</h2>
            <p className="text-[13px] text-ink-3">
              {r ? (r.visits === 0 ? "Primeira visita" : `${r.visits} ${r.visits === 1 ? "visita" : "visitas"}${r.lastVisit ? ` · última ${daysSince(r.lastVisit)}` : ""}`) : " "}
            </p>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Fechar detalhes"
            className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-[9px] text-ink-2 hover:bg-surface-2">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Situação */}
      <div className="flex flex-wrap gap-1.5 px-5 pb-4">
        {appt.status === "DONE" && <Pill tone="success">Concluído</Pill>}
        {appt.status === "NO_SHOW" && <Pill tone="danger">Faltou</Pill>}
        {appt.status === "CANCELLED" && <Pill tone="neutral">Cancelado</Pill>}
        {open && appt.confirmedVia === "WHATSAPP" && <Pill tone="success">Confirmado pelo WhatsApp</Pill>}
        {appt.status === "PENDING" && appt.confirmedVia !== "WHATSAPP" && <Pill tone="warning">Sem confirmação</Pill>}
        {open && appt.arrivedAt && (
          <Pill tone="success">
            Chegou {new Date(appt.arrivedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
          </Pill>
        )}
        {soon && !appt.arrivedAt && <Pill tone="accent">{soon}</Pill>}
        {appt.subscription && <Pill tone="info">{appt.subscription.plan.name}</Pill>}
      </div>

      {/* Dados do horário */}
      <dl className="px-5 text-sm">
        <Row icon={Clock}><span className="flex-1">{appt.startTime} – {appt.endTime} · {when}</span></Row>
        <Row icon={User}><span className="flex-1">{appt.barber.user.name}</span></Row>
        <Row icon={Scissors}>
          <span className="flex-1">{servicesLabel(appt)}</span>
          <span className="font-semibold">
            {appt.subscription?.status === "ACTIVE" && (appt.status !== "DONE" || appt.price === 0)
              ? <span className="text-primary">no plano</span>
              : formatCurrency(appt.price)}
          </span>
        </Row>
        {(appt.tipAmount ?? 0) > 0 && (
          <Row icon={HandCoins}><span className="flex-1">Gorjeta</span><span className="font-semibold text-positive">{formatCurrency(appt.tipAmount!)}</span></Row>
        )}
        {appt.beneficiaryName && <Row icon={CreditCard}><span className="flex-1">{appt.beneficiaryName}</span></Row>}
        {note && <Row icon={StickyNote} top><span className="text-ink-2">{note}</span></Row>}
      </dl>

      {/* Últimas visitas */}
      {r && r.recent.length > 0 && (
        <div className="flex flex-col gap-2 px-5 py-4 mt-1 border-t border-line-2">
          <span className="text-xs font-semibold tracking-[0.06em] uppercase text-ink-3">Últimas visitas</span>
          {r.recent.map((v, i) => (
            <div key={i} className="flex justify-between gap-3 text-[13px]">
              <span className="truncate">{fmtDay(v.date)} · {v.services}</span>
              <span className="text-ink-3 shrink-0">{v.barberName}</span>
            </div>
          ))}
        </div>
      )}

      {/* Ações */}
      <div className="mt-auto flex flex-col gap-2 px-5 pt-4 pb-5 border-t border-line-2">
        {open ? (
          <>
            <button type="button" onClick={() => onConclude(appt)}
              className="h-[46px] rounded-[10px] bg-primary hover:bg-primary/90 text-white text-[15px] font-semibold">
              Concluir e cobrar
            </button>
            <div className="grid grid-cols-3 gap-2">
              <ActionButton onClick={() => onToggleArrived(appt)} pressed={!!appt.arrivedAt}>
                {appt.arrivedAt ? "Desfazer" : "Chegou"}
              </ActionButton>
              {wa ? (
                <a href={wa} target="_blank" rel="noreferrer"
                  className="h-[42px] rounded-[10px] border border-control bg-surface text-ink text-[13px] font-semibold inline-flex items-center justify-center hover:bg-surface-3">
                  Mensagem
                </a>
              ) : <ActionButton disabled>Mensagem</ActionButton>}
              <ActionButton danger onClick={() => onStatus(appt, "NO_SHOW")}>Faltou</ActionButton>
            </div>
            <button type="button" onClick={() => onStatus(appt, "CANCELLED")}
              className="h-9 text-[13px] font-semibold text-ink-3 underline underline-offset-2 hover:text-ink">
              Cancelar agendamento
            </button>
          </>
        ) : appt.status === "DONE" ? (
          <>
            <button type="button" onClick={() => onConclude(appt)}
              className="h-[46px] rounded-[10px] border border-control bg-surface text-ink text-[15px] font-semibold hover:bg-surface-3">
              Ver comanda
            </button>
            <button type="button" onClick={() => onReopen(appt)} className="h-9 text-[13px] font-semibold text-ink-3 underline underline-offset-2 hover:text-ink">
              Reabrir atendimento
            </button>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <ActionButton onClick={() => onReopen(appt)}>Reabrir</ActionButton>
            <ActionButton danger onClick={() => onDelete(appt)}>Excluir</ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon: Icon, children, top }: { icon: React.ElementType; children: React.ReactNode; top?: boolean }) {
  return (
    <div className={cn("flex gap-3 border-t border-line-3", top ? "items-start py-3" : "items-center min-h-11")}>
      <Icon className={cn("w-[18px] h-[18px] text-ink-3 shrink-0", top && "mt-0.5")} aria-hidden />
      {children}
    </div>
  );
}

function ActionButton({ children, danger, pressed, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean; pressed?: boolean }) {
  return (
    <button type="button" aria-pressed={pressed} {...props}
      className={cn(
        "h-[42px] rounded-[10px] border bg-surface text-[13px] font-semibold disabled:opacity-40",
        danger ? "border-[#F2C9C4] text-danger-strong hover:bg-danger-soft" : "border-control text-ink hover:bg-surface-3",
        pressed && "bg-positive-soft border-positive/30 text-positive"
      )}>
      {children}
    </button>
  );
}
