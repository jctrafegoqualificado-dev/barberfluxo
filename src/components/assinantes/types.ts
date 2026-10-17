import { formatCurrency } from "@/lib/utils";
import { CYCLE_LABEL, dueKey, subState, type SubState } from "@/lib/subscriptionCycle";

export interface Payment { id: string; amount: number; method: string; status: string; paidAt: string | null; createdAt: string }
export interface Beneficiary { name: string; uses: number; maxUses: number }
export interface Sub {
  id: string; status: string; startDate: string; nextBillingDate: string; billingDay: number | null; usesThisCycle: number;
  createdAt: string;
  beneficiaries?: Beneficiary[] | null;
  mpPreapprovalId?: string | null; authorizationStatus?: string | null; authorizationLink?: string | null; authorizationSentAt?: string | null;
  paymentMethod?: string | null;
  client: { id: string; name: string; email: string; phone: string | null };
  plan: {
    id: string; name: string; price: number; billingCycle: string; maxUses: number | null; active?: boolean;
    planServices?: { quantity: number | null; service: { id: string; name: string; price: number } }[];
  };
  payments: Payment[];
}
export interface PlanOption { id: string; name: string; price: number; billingCycle: string; active: boolean }

export type Tab = "active" | "today" | "late" | "paused" | "cancelled";

export const brl = (v: number) => formatCurrency(v).replace(",00", "");
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "16 out" a partir de YYYY-MM-DD. */
export function shortDay(key: string) {
  const [, m, d] = key.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]}`;
}

export function priceText(sub: Pick<Sub, "plan">) {
  return `${brl(sub.plan.price)}/${CYCLE_LABEL[sub.plan.billingCycle] ?? "mês"}`;
}

/** Uso do ciclo: "3 de 4" (com limite) ou "3 usos". Dependentes somam as cotas. */
export function usage(sub: Sub): { text: string; pct: number; full: boolean; over: boolean } {
  const ben = Array.isArray(sub.beneficiaries) && sub.beneficiaries.length ? sub.beneficiaries : null;
  const used = ben ? ben.reduce((s, b) => s + (b.uses || 0), 0) : sub.usesThisCycle;
  const limit = ben ? ben.reduce((s, b) => s + (b.maxUses || 0), 0) : sub.plan.maxUses;
  if (!limit) return { text: used === 0 ? "nenhum uso" : `${used} uso${used === 1 ? "" : "s"}`, pct: 0, full: false, over: false };
  const full = used >= limit;
  const over = used > limit;
  // O limite ainda não é aplicado na agenda: quem passou aparece em vermelho
  const text = over ? `${used} de ${limit} · passou ${used - limit}` : full ? `${used} de ${limit} · limite` : `${used} de ${limit}`;
  return { text, pct: Math.min(100, Math.round((used / limit) * 100)), full, over };
}

export function methodText(sub: Sub) {
  switch (sub.authorizationStatus) {
    case "AUTHORIZED": return "Débito automático";
    case "PENDING_AUTH": return "aguarda autorização";
    case "FAILED": return "Cartão (débito automático)";
    case "PAUSED": return "Débito automático pausado";
  }
  return sub.paymentMethod === "CASH" ? "Dinheiro" : sub.paymentMethod === "CARD" ? "Cartão" : "Pix";
}

export const STATE_BADGE: Record<SubState, [string, string]> = {
  ok: ["Em dia", "bg-positive-soft text-positive"],
  today: ["A pagar hoje", "bg-warning-soft text-warning"],
  failed: ["Cartão recusado", "bg-danger-soft text-danger"],
  late: ["Atrasado", "bg-danger-soft text-danger"],
  auth: ["Link enviado", "bg-surface-2 text-ink-2"],
  paused: ["Pausado", "bg-surface-2 text-ink-2"],
  cancelled: ["Cancelado", "bg-surface-2 text-ink-3"],
};

export function stateOf(sub: Sub, today: string) {
  const s = subState(sub, today);
  const [label, cls] = STATE_BADGE[s.state];
  const text = s.state === "late" ? (s.lateDays > 0 ? `Atrasado ${s.lateDays} dia${s.lateDays === 1 ? "" : "s"}` : "Atrasado") : label;
  return { ...s, text, cls };
}

export function dueText(sub: Sub, today: string) {
  if (sub.status === "CANCELLED") return "—";
  const k = dueKey(sub.nextBillingDate);
  return k === today ? "Hoje" : shortDay(k);
}

/** Mensagem pronta de cobrança no WhatsApp. */
export function whatsappCharge(sub: Sub) {
  const phone = sub.client.phone?.replace(/\D/g, "");
  if (!phone) return null;
  const first = sub.client.name.split(" ")[0];
  const due = shortDay(dueKey(sub.nextBillingDate));
  const msg = `Olá, ${first}! Tudo bem? Passando para lembrar da mensalidade do seu plano *${sub.plan.name}* (${brl(sub.plan.price)}), que venceu em ${due}. Se já pagou, me avise que eu dou baixa aqui. Obrigado! 💈`;
  return `https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${encodeURIComponent(msg)}`;
}

export const isFakeEmail = (email: string | null | undefined) => !email || /@cliente\./i.test(email);

/** "há 7 meses" a partir da data de início. */
export function since(startDate: string, today: string) {
  const [y1, m1] = dueKey(startDate).split("-").map(Number);
  const [y2, m2] = today.split("-").map(Number);
  const months = (y2 - y1) * 12 + (m2 - m1);
  if (months <= 0) return "assinou este mês";
  if (months < 12) return `assinante há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `assinante há ${years} ano${years === 1 ? "" : "s"}${months % 12 ? ` e ${months % 12} ${months % 12 === 1 ? "mês" : "meses"}` : ""}`;
}
