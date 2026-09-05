import { prisma } from "./prisma";
import * as evolution from "./evolution/client";

/**
 * Normaliza número de telefone para formato internacional.
 * Remove não-dígitos e adiciona código do país +55 se necessário — mas só
 * quando o número não já vem com código de país explícito (prefixo "+"),
 * o que permite cadastrar barbeiros com WhatsApp de outros países (ex.: "+7 ...").
 *
 * Exemplos:
 *   "41998861196"      → "5541998861196"   (11 dígitos → adiciona 55)
 *   "5541998861196"    → "5541998861196"   (13 dígitos → já tem 55)
 *   "+55 (41) 99886-1196" → "5541998861196" (formatos com máscara)
 *   "+7 977 586-70-18" → "79775867018"     ("+" explícito → não mexe no país)
 */
function normalizeBrPhone(phone: string): string {
  if (phone.trim().startsWith("+")) return phone.replace(/\D/g, "");
  const digits = phone.replace(/\D/g, "");
  // Já tem código do país 55: 12 dígitos (fixo) ou 13 dígitos (celular)
  if (digits.length >= 12 && digits.startsWith("55")) return digits;
  // Adiciona código do Brasil
  return `55${digits}`;
}

/**
 * Mensagem de boas-vindas para um cliente recém-cadastrado (1ª vez na barbearia).
 * Texto puro — pode ser enviado por qualquer canal (Evolution/Z-API) ou combinado
 * com outra mensagem (ex.: atendimento iniciado / reserva) num único envio.
 */
export function welcomeMessage(shopName: string, clientName: string): string {
  const firstName = clientName.split(" ")[0];
  return `👋 Olá, *${firstName}*! Seja muito bem-vindo(a) à *${shopName}*! Que bom ter você com a gente. Estamos à disposição por aqui sempre que precisar. 💈`;
}

/**
 * Envia uma mensagem de WhatsApp para um cliente ou barbeiro.
 * Busca automaticamente a instância conectada da barbearia.
 */
export async function sendWhatsAppNotification(barbershopId: string, phone: string, text: string) {
  try {
    // 1. Busca instância conectada
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { barbershopId },
    });

    if (!instance || instance.status !== "CONNECTED") {
      console.warn(`⚠️ [Notification] Skip: Instância não conectada para barbearia ${barbershopId}`);
      return { success: false, reason: "NOT_CONNECTED" };
    }

    // 2. Normaliza número para formato internacional (+55 Brasil)
    const normalizedPhone = normalizeBrPhone(phone);

    // 3. Envia mensagem
    const result = await evolution.sendMessage(
      instance.evolutionInstanceName,
      normalizedPhone,
      text
    );

    if ("error" in result) {
      console.error(`❌ [Notification] Erro ao enviar: ${result.error}`);
      return { success: false, reason: result.error };
    }

    console.log(`✅ [Notification] Mensagem enviada para ${normalizedPhone} (original: ${phone})`);
    return { success: true, key: result.key };
  } catch (error) {
    console.error("❌ [Notification] Erro interno:", error);
    return { success: false, reason: "INTERNAL_ERROR" };
  }
}

/**
 * Notifica o barbeiro, no WhatsApp dele e pela instância da própria barbearia,
 * sobre um novo agendamento. Fonte única usada por TODOS os fluxos de criação:
 * link público, painel do dono e bot n8n (API v1).
 *
 * Regras:
 *  - Respeita o toggle `notifyBarberOnNewAppointment` da barbearia (default ON).
 *  - Não notifica quando quem criou o agendamento é o próprio barbeiro
 *    (`createdByUserId` === userId do barbeiro) — evita spam no autoagendamento.
 *  - Sem gate de plano: é higiene operacional, funciona em qualquer plano pago.
 *  - Fire-and-forget: nunca lança — falha de envio não pode quebrar o agendamento.
 */
export async function notifyBarberNewAppointment(opts: {
  barbershopId: string;
  barberId: string;
  clientName: string;
  dateLabel: string; // já formatado, ex: "17/05/2026"
  startTime: string;
  servicesLabel: string;
  createdByUserId?: string;
}): Promise<void> {
  try {
    const shop = await prisma.barbershop.findUnique({
      where: { id: opts.barbershopId },
      select: { name: true, notifyBarberOnNewAppointment: true },
    });
    if (!shop?.notifyBarberOnNewAppointment) return;

    const barber = await prisma.barber.findUnique({
      where: { id: opts.barberId },
      select: { userId: true, user: { select: { phone: true } } },
    });
    if (!barber?.user.phone) return;
    // Não avisa o próprio barbeiro quando foi ele quem criou o agendamento.
    if (opts.createdByUserId && barber.userId === opts.createdByUserId) return;

    const msg =
      `Novo Agendamento - ${shop.name}\n\n` +
      `Cliente: ${opts.clientName}\n` +
      `Data: ${opts.dateLabel}\n` +
      `Horario: ${opts.startTime}\n` +
      `Servico: ${opts.servicesLabel}`;

    await sendWhatsAppNotification(opts.barbershopId, barber.user.phone, msg);
  } catch (error) {
    console.error("❌ [notifyBarberNewAppointment] Erro:", error);
  }
}

/**
 * Notifica o(s) barbeiro(s) quando um agendamento é REMARCADO.
 *
 * Até aqui só o cliente era avisado da mudança. O barbeiro ficava com a mensagem
 * original do agendamento — dizendo o horário antigo — e ao abrir a agenda via
 * outro horário, concluindo que o sistema havia mudado sozinho. Era a origem do
 * relato "a confirmação diz 11h, a agenda mostra 13h".
 *
 * Quando o agendamento troca de profissional, os dois são avisados: quem perdeu
 * o horário e quem ganhou.
 *
 * Mesmas regras de notifyBarberNewAppointment: respeita o toggle da barbearia,
 * não avisa quem fez a própria alteração, e nunca lança.
 */
export async function notifyBarberAppointmentMoved(opts: {
  barbershopId: string;
  fromBarberId: string;
  toBarberId: string;
  clientName: string;
  dateLabel: string;
  fromStartTime: string;
  toStartTime: string;
  changedByUserId?: string;
}): Promise<void> {
  try {
    const shop = await prisma.barbershop.findUnique({
      where: { id: opts.barbershopId },
      select: { name: true, notifyBarberOnNewAppointment: true },
    });
    if (!shop?.notifyBarberOnNewAppointment) return;

    const trocouDeBarbeiro = opts.fromBarberId !== opts.toBarberId;
    const alvos = trocouDeBarbeiro ? [opts.fromBarberId, opts.toBarberId] : [opts.toBarberId];

    const barbers = await prisma.barber.findMany({
      where: { id: { in: alvos } },
      select: { id: true, userId: true, user: { select: { phone: true } } },
    });

    await Promise.all(
      barbers.map(async (barber) => {
        if (!barber.user.phone) return;
        // Quem fez a alteração já sabe dela.
        if (opts.changedByUserId && barber.userId === opts.changedByUserId) return;

        const saiuDaAgenda = trocouDeBarbeiro && barber.id === opts.fromBarberId;
        const msg = saiuDaAgenda
          ? `Agendamento Remanejado - ${shop.name}\n\n` +
            `Cliente: ${opts.clientName}\n` +
            `Data: ${opts.dateLabel}\n` +
            `Este atendimento das ${opts.fromStartTime} saiu da sua agenda.`
          : `Agendamento Remarcado - ${shop.name}\n\n` +
            `Cliente: ${opts.clientName}\n` +
            `Data: ${opts.dateLabel}\n` +
            `Horario: ${opts.fromStartTime} passou para ${opts.toStartTime}`;

        await sendWhatsAppNotification(opts.barbershopId, barber.user.phone, msg);
      })
    );
  } catch (error) {
    console.error("❌ [notifyBarberAppointmentMoved] Erro:", error);
  }
}
