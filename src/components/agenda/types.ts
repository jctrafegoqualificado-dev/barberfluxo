/* Tipos da agenda do painel (src/app/(painel)/painel/agendamentos) */

export interface AppointmentServiceItem {
  service: { id: string; name: string; price: number; duration: number };
  price: number; duration: number;
}

export interface Appointment {
  id: string; startTime: string; endTime: string; status: string; price: number; date: string;
  paymentMethod: string | null;
  discountPercent?: number;
  tipAmount?: number;
  arrivedAt?: string | null;
  confirmedVia?: string | null;
  notes?: string | null;
  client: { id?: string; name: string; phone: string };
  service: { id: string; name: string; duration: number } | null;
  services: AppointmentServiceItem[];
  barber: { id: string; nickname?: string | null; user: { name: string; phone?: string } };
  subscription: { id: string; status: string; usesThisCycle?: number; plan: { name: string; maxUses?: number | null; planServices: { serviceId: string }[] } } | null;
  beneficiaryName: string | null;
}

export interface Bloqueio {
  id: string; startTime: string; endTime: string; reason: string | null;
  barber: { id: string; user: { name: string } };
}

export interface Barber {
  id: string; nickname?: string | null; photoUrl?: string | null;
  workStart?: string | null; workEnd?: string | null;
  user: { name: string; phone?: string };
}

export interface WeekDay { date: string; count: number; isOpen: boolean }
export interface DayHours { isOpen: boolean; open: string | null; close: string | null; reason: string | null }

/* ─── Helpers ─── */

export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const getInitials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
export const servicesLabel = (a: Appointment) =>
  a.services.length > 0 ? a.services.map((s) => s.service.name).join(" + ") : a.service?.name ?? "Serviço";
export const barberShortName = (b: { nickname?: string | null; user: { name: string } }) =>
  b.nickname || b.user.name.split(" ")[0];

/** "AAAA-MM-DD" de hoje no fuso de São Paulo. */
export function localDateStr(d = new Date()) {
  return new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(d);
}

/** Minutos desde 00:00 agora, em São Paulo. */
export function nowMinutesSP() {
  const t = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  return toMin(t);
}

export const isOpenStatus = (s: string) => s === "CONFIRMED" || s === "PENDING";

/**
 * Visual dos horários na grade (docs/design/Agenda-desktop.dc.html):
 * concluído bege, falta riscada em vermelho, confirmado branco com borda,
 * sem confirmação creme tracejado, selecionado na cor da barbearia.
 */
export function cardStyle(status: string, selected: boolean) {
  if (selected) return { box: "bg-primary/10 border-2 border-primary", name: "text-ink", meta: "text-ink-2", strike: false };
  switch (status) {
    case "DONE":      return { box: "bg-surface-3 border border-surface-3", name: "text-ink-2", meta: "text-ink-3", strike: false };
    case "NO_SHOW":   return { box: "bg-danger-soft border border-[#E3A59D]", name: "text-danger", meta: "text-danger", strike: true };
    case "PENDING":   return { box: "bg-[#FFF8E8] border border-dashed border-[#B08A2E]", name: "text-ink", meta: "text-warning", strike: false };
    case "CANCELLED": return { box: "bg-surface border border-dashed border-control opacity-60", name: "text-ink-3", meta: "text-ink-4", strike: true };
    default:          return { box: "bg-surface border border-[#B9B0A1]", name: "text-ink", meta: "text-ink-2", strike: false };
  }
}

export const STATUS_NOTE: Record<string, string> = {
  DONE: "concluído", NO_SHOW: "faltou", CONFIRMED: "confirmado", PENDING: "sem confirmação", CANCELLED: "cancelado",
};

/** Mensagem pronta para o WhatsApp do cliente (wa.me). */
export function whatsappLink(phone: string | null | undefined, text?: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
