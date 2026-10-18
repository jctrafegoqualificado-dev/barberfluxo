import { prisma } from "@/lib/prisma";
import { onlyDigits, phoneVariants } from "@/lib/phone";
import { logAudit } from "@/lib/audit";
import { notifyWaitlistSlotOpened } from "@/lib/waitlist";

/**
 * Atendimento pelo WhatsApp que depende da conversa (n8n):
 *  - resposta SIM/NÃO ao lembrete (confirma ou cancela o agendamento);
 *  - passar a conversa para a barbearia ("precisa de você") e pausar a IA.
 *
 * O n8n chama as rotas /api/v1/barbershops/[slug]/{reminder-reply,handoff,ai-status};
 * o painel usa /api/barbershop/whatsapp/atendimento. Ver docs/redesign/n8n-integracao.md.
 */

/** Por quanto tempo a IA fica calada depois de passar a conversa (o dono pode devolver antes). */
export const DEFAULT_PAUSE_HOURS = 12;

const YES = new Set(["sim", "s", "ss", "simm", "confirmo", "confirmado", "confirmada", "confirma", "ok", "okay", "blz", "beleza", "certo", "fechado", "👍", "✅"]);
const NO = new Set(["nao", "n", "nn", "naoo", "cancela", "cancelar", "cancelo", "desmarca", "desmarcar", "❌", "👎"]);
// Depois da primeira palavra, só aceita complementos que não mudam o sentido ("sim, obrigado").
const FILLER = new Set(["obrigado", "obrigada", "obg", "vlw", "valeu", "confirmo", "confirmado", "pode", "confirmar", "por", "favor", "pf", "vou", "estarei", "ai", "la", "sim", "nao", "posso", "poder", "consigo", "conseguir", "ir", "vai", "dar", "da"]);

const normalize = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[!.,;]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Interpreta a resposta do cliente ao lembrete. Só aceita respostas curtas e inequívocas
 * ("sim", "Sim, obrigado!", "não vou poder"); pergunta ou frase com outro assunto volta null
 * e a IA segue a conversa normalmente.
 */
export function parseReminderAnswer(text: string | null | undefined): "YES" | "NO" | null {
  if (!text || text.includes("?")) return null;
  const words = normalize(text).split(" ").filter(Boolean);
  if (words.length === 0 || words.length > 4) return null;
  const [first, ...rest] = words;
  if (!rest.every((w) => FILLER.has(w))) return null;
  if (NO.has(first)) return "NO";
  if (YES.has(first)) return rest.includes("nao") ? null : "YES";
  return null;
}

const todaySP = () => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** Contato do WhatsApp pelo telefone; cria se ainda não existir (remoteJid no formato da Evolution). */
async function findOrCreateContact(barbershopId: string, phone: string, name?: string | null) {
  const digits = onlyDigits(phone);
  const existing = await prisma.whatsAppContact.findFirst({
    where: { barbershopId, phone: { in: phoneVariants(digits) } },
    orderBy: { lastSeenAt: "desc" },
  });
  if (existing) return existing;
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return prisma.whatsAppContact.upsert({
    where: { remoteJid_barbershopId: { remoteJid: `${full}@s.whatsapp.net`, barbershopId } },
    update: {},
    create: { remoteJid: `${full}@s.whatsapp.net`, phone: full, pushName: name ?? null, barbershopId },
  });
}

export type ReminderReplyResult =
  | { result: "CONFIRMED" | "CANCELLED"; appointment: { id: string; date: string; startTime: string; barberName: string }; replyText: string }
  | { result: "CANCEL_BLOCKED"; appointment: { id: string; date: string; startTime: string; barberName: string }; replyText: string }
  | { result: "NOT_UNDERSTOOD" | "NOT_FOUND" | "DISABLED"; replyText: null };

/**
 * Aplica a resposta ao lembrete no próximo agendamento do cliente que recebeu lembrete.
 * NÃO segue as regras do cancelamento pelo link (cliente pode cancelar? antecedência mínima?);
 * se a regra impede, não cancela e passa a conversa para a barbearia.
 */
export async function handleReminderReply(opts: {
  barbershopId: string;
  phone: string;
  text?: string | null;
  answer?: "YES" | "NO" | null;
}): Promise<ReminderReplyResult> {
  const answer = opts.answer ?? parseReminderAnswer(opts.text);
  if (!answer) return { result: "NOT_UNDERSTOOD", replyText: null };

  const shop = await prisma.barbershop.findUnique({
    where: { id: opts.barbershopId },
    select: { name: true, reminderAskConfirmation: true, cancelByClientEnabled: true, minCancelHours: true },
  });
  if (!shop || !shop.reminderAskConfirmation) return { result: "DISABLED", replyText: null };

  const appt = await prisma.appointment.findFirst({
    where: {
      barbershopId: opts.barbershopId,
      client: { phone: { in: phoneVariants(opts.phone) } },
      reminderSent: true,
      status: { in: ["PENDING", "CONFIRMED"] },
      date: { gte: new Date(todaySP() + "T00:00:00Z") },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true, date: true, startTime: true, barberId: true, status: true, clientId: true,
      client: { select: { name: true } },
      barber: { select: { nickname: true, user: { select: { name: true } } } },
    },
  });
  if (!appt) return { result: "NOT_FOUND", replyText: null };

  const day = appt.date.toISOString().slice(0, 10);
  const barberName = appt.barber.nickname || appt.barber.user.name.split(" ")[0];
  const info = { id: appt.id, date: day, startTime: appt.startTime, barberName };
  const firstName = appt.client.name.split(" ")[0];
  const when = `${day === todaySP() ? "hoje" : new Date(day + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })} às ${appt.startTime}`;

  if (answer === "YES") {
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedVia: "WHATSAPP" },
    });
    void logAudit({ barbershopId: opts.barbershopId, action: "STATUS_CHANGE", entity: "Appointment", entityId: appt.id,
      diff: { before: { status: appt.status }, after: { status: "CONFIRMED", confirmedVia: "WHATSAPP" } } });
    return { result: "CONFIRMED", appointment: info, replyText: `Perfeito, ${firstName}! Seu horário ${when} com ${barberName} está confirmado. Até lá! 💈` };
  }

  const hoursLeft = (new Date(`${day}T${appt.startTime}:00-03:00`).getTime() - Date.now()) / 3_600_000;
  const blocked = !shop.cancelByClientEnabled || (shop.minCancelHours > 0 && hoursLeft < shop.minCancelHours);
  if (blocked) {
    await requestHandoff({
      barbershopId: opts.barbershopId,
      phone: opts.phone,
      name: appt.client.name,
      reason: `Respondeu NÃO ao lembrete de ${when} (cancelamento pelo cliente não permitido)`,
    });
    return {
      result: "CANCEL_BLOCKED", appointment: info,
      replyText: `Entendido, ${firstName}. Já avisei a equipe da ${shop.name}, que vai falar com você sobre o horário ${when}.`,
    };
  }

  await prisma.appointment.update({ where: { id: appt.id }, data: { status: "CANCELLED" } });
  void logAudit({ barbershopId: opts.barbershopId, action: "CANCEL", entity: "Appointment", entityId: appt.id,
    diff: { before: { status: appt.status }, after: { status: "CANCELLED", via: "Resposta NÃO ao lembrete" } } });
  void notifyWaitlistSlotOpened({ barbershopId: opts.barbershopId, date: appt.date, barberId: appt.barberId, startTime: appt.startTime });
  return { result: "CANCELLED", appointment: info, replyText: `Tudo bem, ${firstName}, cancelei seu horário ${when}. Quando quiser remarcar, é só chamar! 👋` };
}

/** A IA passa a conversa para a barbearia: aparece em "Precisam de você" e a IA pausa. */
export async function requestHandoff(opts: {
  barbershopId: string;
  phone: string;
  reason: string;
  name?: string | null;
  pauseHours?: number;
}) {
  const contact = await findOrCreateContact(opts.barbershopId, opts.phone, opts.name);
  const hours = Math.min(72, Math.max(1, opts.pauseHours ?? DEFAULT_PAUSE_HOURS));
  return prisma.whatsAppContact.update({
    where: { id: contact.id },
    data: {
      handoffAt: new Date(),
      handoffReason: opts.reason.slice(0, 300),
      aiPausedUntil: new Date(Date.now() + hours * 3_600_000),
    },
    select: { id: true, aiPausedUntil: true },
  });
}

/** O n8n pergunta antes de responder: a IA está pausada para este contato? */
export async function getAiStatus(barbershopId: string, phone: string) {
  const contact = await prisma.whatsAppContact.findFirst({
    where: { barbershopId, phone: { in: phoneVariants(phone) }, aiPausedUntil: { gt: new Date() } },
    select: { aiPausedUntil: true, handoffReason: true },
  });
  return contact
    ? { aiPaused: true, until: contact.aiPausedUntil, reason: contact.handoffReason }
    : { aiPaused: false, until: null, reason: null };
}

/** O dono devolve a conversa para a IA (ou a pausa manualmente). */
export async function setContactAi(barbershopId: string, contactId: string, action: "release" | "pause") {
  const data = action === "release"
    ? { aiPausedUntil: null, handoffAt: null, handoffReason: null }
    : { aiPausedUntil: new Date(Date.now() + DEFAULT_PAUSE_HOURS * 3_600_000), handoffAt: new Date(), handoffReason: "Pausada pelo painel" };
  return prisma.whatsAppContact.updateMany({ where: { id: contactId, barbershopId }, data });
}
