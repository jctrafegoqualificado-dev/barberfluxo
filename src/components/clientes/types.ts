/* Tipos e textos compartilhados da lista e da ficha de Clientes (docs/design/Clientes-*, Ficha-cliente-celular). */

export interface ClienteRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isBlocked: boolean;
  birthday: string | null;
  since: string;
  totalVisits: number;
  totalSpent: number;
  thisMonthVisits: number;
  lastVisit: string | null;
  daysSinceLastVisit: number | null;
  avgFrequency: number | null;
  isNew: boolean;
  noShowCount: number;
  activePlan: string | null;
  planPrice: number | null;
  preferredBarber: string | null;
  hasUpcoming: boolean;
  expectedInterval: number | null;
  lapsed: boolean;
  overdueDays: number;
  frequent: boolean;
  monthlyValue: number;
  lastRetentionAt: string | null;
}

export interface ShopInfo { slug: string; name: string; retentionEnabled: boolean; retentionDays: number }

export interface HistoryItem {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  status: string;
  services: string;
  barberName: string;
  paymentMethod: string | null;
  price: number;
  viaPlan: boolean;
}

export interface Ficha {
  client: { id: string; name: string; phone: string | null; email: string | null; birthday: string | null; isBlocked: boolean; since: string };
  stats: { visits: number; spent: number; avgTicket: number; noShows: number };
  rhythm: {
    expected: number | null; lapsed: boolean; overdueDays: number; avgFrequency: number | null;
    daysSinceLastVisit: number | null; lastVisit: { date: string; barberName: string } | null;
  };
  preferred: { barberId: string; barberName: string; services: string | null; serviceIds: string[] } | null;
  subscription: { id: string; status: string; planName: string; price: number; nextBillingDate: string | null } | null;
  note: { content: string; updatedAt: string; updatedBy: string | null } | null;
  lastRetentionAt: string | null;
  upcoming: HistoryItem[];
  history: HistoryItem[];
  shop: { slug: string; name: string } | null;
}

export type Segment = "todos" | "frequentes" | "sumidos" | "assinantes" | "aniversario" | "bloqueados";

/** Cores do "sumido" no design (laranja queimado). */
export const LAPSED = {
  bg: "bg-[#FDF1E9]",
  border: "border-[#F3D3BD]",
  text: "text-[#7A3410]",
  late: "text-[#9A4A13]",
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const monthName = (m: number) => MONTHS[m];

/** Mês atual em São Paulo (0–11). */
export function currentMonthSP() {
  return Number(new Intl.DateTimeFormat("en", { timeZone: "America/Sao_Paulo", month: "numeric" }).format(new Date())) - 1;
}

/** Aniversário guardado à meia-noite UTC: lê sempre em UTC para não voltar um dia. */
export function birthdayParts(iso: string) {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso);
  return { day: d.getUTCDate(), month: d.getUTCMonth() };
}

export function birthdayLabel(iso: string | null) {
  if (!iso) return null;
  const { day, month } = birthdayParts(iso);
  return `${day} de ${MONTHS[month]}`;
}

/** "9 de agosto" a partir de YYYY-MM-DD ou ISO (dia do agendamento, guardado em T12:00Z). */
export function dayMonth(iso: string) {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso);
  return `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}

export function dayMonthShort(iso: string) {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso);
  return { day: String(d.getUTCDate()).padStart(2, "0"), month: MONTHS_SHORT[d.getUTCMonth()] };
}

/** "mar/2025" */
export function monthYear(iso: string) {
  const d = new Date(iso);
  return `${MONTHS_SHORT[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

export function lastVisitLabel(days: number | null) {
  if (days === null) return "nunca veio";
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

export function frequencyLabel(c: Pick<ClienteRow, "avgFrequency" | "totalVisits">) {
  if (c.avgFrequency) return `a cada ${c.avgFrequency} dias`;
  if (c.totalVisits === 1) return "veio 1 vez";
  return "—";
}

/** (41) 99812-4410 */
export function formatPhone(phone: string | null) {
  if (!phone) return "";
  let d = phone.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

/** Link do WhatsApp (wa.me) com DDI 55 e a mensagem pronta. */
export function waLink(phone: string, text?: string) {
  let d = phone.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Mensagem de "chamar de volta" — o dono pode editar antes de enviar. */
export function comebackMessage(opts: { name: string; shopName?: string | null; barberName?: string | null; slug?: string | null }) {
  const link = opts.slug && typeof window !== "undefined" ? `${window.location.origin}/agendar/${opts.slug}` : null;
  const lines = [
    `Fala, ${firstName(opts.name)}! Faz tempo que você não passa aqui${opts.shopName ? ` na ${opts.shopName}` : ""}.`,
    opts.barberName ? `O ${opts.barberName} tem horário essa semana, quer marcar?` : "Bora marcar um horário essa semana?",
  ];
  if (link) lines.push(`É só escolher aqui: ${link}`);
  return lines.join(" ");
}

/** Um selo por linha, na ordem do que mais importa. */
export function rowTag(c: ClienteRow): { label: string; cls: string } | null {
  if (c.isBlocked) return { label: "Bloqueado", cls: "bg-surface-2 text-ink-2" };
  if (c.lapsed) return { label: "Sumido", cls: `${LAPSED.bg} ${LAPSED.text}` };
  if (c.noShowCount >= 2) return { label: `${c.noShowCount} faltas`, cls: "bg-danger-soft text-danger" };
  if (c.activePlan) return { label: "Assinante", cls: "bg-primary/10 text-primary" };
  if (c.isNew) return { label: "Novo", cls: "bg-positive-soft text-positive" };
  return null;
}

export function inSegment(c: ClienteRow, seg: Segment, month: number) {
  switch (seg) {
    case "todos": return true;
    case "frequentes": return c.frequent && !c.isBlocked;
    case "sumidos": return c.lapsed && !c.isBlocked;
    case "assinantes": return !!c.activePlan;
    case "aniversario": return !!c.birthday && birthdayParts(c.birthday).month === month;
    case "bloqueados": return c.isBlocked;
  }
}

export const PAYMENT_LABELS: Record<string, string> = {
  PIX: "Pix", CASH: "dinheiro", DEBIT: "débito", DEBIT_CARD: "débito", CREDIT: "crédito", CREDIT_CARD: "crédito",
  CARD: "cartão", SUBSCRIPTION: "plano",
};
