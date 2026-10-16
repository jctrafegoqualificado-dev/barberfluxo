import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
}

// Formata uma data de "dia-calendário" (vencimento, data de atendimento, última visita)
// SEM conversão de fuso. Esses valores guardam o DIA (gravado em UTC), então formatar em
// UTC evita "voltar um dia" no navegador em fuso negativo (Brasil, UTC-3). Para instantes
// reais (createdAt, "hoje", paidAt) use formatDate/formatDateTime.
export function formatDay(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(date));
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  DONE: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Faltou",
  ACTIVE: "Ativo",
  OVERDUE: "Inadimplente",
  PAUSED: "Pausado",
};

// Cores de estado do redesign (mesmos tons do <Badge>/<Pill> em components/ui/Badge.tsx)
export const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-warning-soft text-warning",
  CONFIRMED: "bg-[#E8EEF7] text-[#1F4E8C]",
  DONE: "bg-positive-soft text-positive",
  CANCELLED: "bg-surface-2 text-ink-2",
  NO_SHOW: "bg-danger-soft text-danger",
  ACTIVE: "bg-positive-soft text-positive",
  OVERDUE: "bg-danger-soft text-danger",
  PAUSED: "bg-warning-soft text-warning",
};
