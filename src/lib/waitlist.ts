import { prisma } from "@/lib/prisma";
import { sendWhatsAppNotification } from "@/lib/notifications";
import { phoneVariants } from "@/lib/phone";

/**
 * Lista de espera do agendamento online.
 *
 * Quando um agendamento é cancelado (painel, exclusão ou pelo próprio cliente), os
 * primeiros da fila daquele dia recebem um WhatsApp com o link. Não há reserva: quem
 * agendar primeiro leva a vaga, e a entrada dele vira BOOKED (ver markWaitlistBooked).
 */

/** Quantos da fila são avisados a cada vaga aberta. */
const NOTIFY_PER_SLOT = 3;

const todaySP = () => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date());
const nowMinSP = () => {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date()).split(":").map(Number);
  return h * 60 + m;
};

/** Appointment.date é gravado como "AAAA-MM-DDT12:00:00Z"; o dia é a parte da data. */
export const appointmentDay = (date: Date) => date.toISOString().slice(0, 10);

function dayLabel(day: string) {
  if (day === todaySP()) return "hoje";
  const d = new Date(day + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

/**
 * Avisa a fila de que abriu uma vaga. Chamado sem await (fire-and-forget) depois do
 * cancelamento — falha aqui nunca pode desfazer o cancelamento.
 */
export async function notifyWaitlistSlotOpened(opts: {
  barbershopId: string;
  date: Date;
  barberId: string;
  startTime: string;
}): Promise<void> {
  try {
    const day = appointmentDay(opts.date);
    const today = todaySP();
    if (day < today) return;
    if (day === today) {
      const [h, m] = opts.startTime.split(":").map(Number);
      if (h * 60 + m <= nowMinSP()) return; // a vaga já passou
    }

    const entries = await prisma.waitlistEntry.findMany({
      where: {
        barbershopId: opts.barbershopId,
        date: day,
        // Quem já foi avisado e não pegou a vaga continua na fila, mas depois de quem nunca foi avisado.
        status: { in: ["WAITING", "NOTIFIED"] },
        OR: [{ barberId: opts.barberId }, { anyBarber: true }],
      },
      orderBy: [{ notifiedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      take: NOTIFY_PER_SLOT,
    });
    if (entries.length === 0) return;

    const [shop, barber] = await Promise.all([
      prisma.barbershop.findUnique({ where: { id: opts.barbershopId }, select: { name: true, slug: true } }),
      prisma.barber.findUnique({ where: { id: opts.barberId }, select: { nickname: true, user: { select: { name: true } } } }),
    ]);
    if (!shop) return;

    const barberName = barber?.nickname || barber?.user.name.split(" ")[0] || "nossa equipe";
    const slotLabel = `${opts.startTime} com ${barberName}`;
    const link = `${process.env.NEXTAUTH_URL ?? "https://iadebarbearia.com.br"}/agendar/${shop.slug}`;

    for (const e of entries) {
      const msg =
        `🔔 *Abriu uma vaga na ${shop.name}!*\n\n` +
        `Olá ${e.clientName.split(" ")[0]}, você pediu para avisar: tem horário ${dayLabel(day)} às *${slotLabel}*.\n\n` +
        `Quem agendar primeiro leva 👉 ${link}`;
      sendWhatsAppNotification(opts.barbershopId, e.clientPhone, msg).catch(console.error);
    }

    await prisma.waitlistEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { status: "NOTIFIED", notifiedAt: new Date(), notifiedSlot: slotLabel },
    });
  } catch (e) {
    console.error("[waitlist] falha ao avisar a fila:", e);
  }
}

/** Quem estava na fila e agendou aquele dia sai da fila. */
export async function markWaitlistBooked(opts: { barbershopId: string; phone: string; date: string }): Promise<void> {
  try {
    await prisma.waitlistEntry.updateMany({
      where: {
        barbershopId: opts.barbershopId,
        date: opts.date,
        clientPhone: { in: phoneVariants(opts.phone) },
        status: { in: ["WAITING", "NOTIFIED"] },
      },
      data: { status: "BOOKED" },
    });
  } catch (e) {
    console.error("[waitlist] falha ao baixar da fila:", e);
  }
}
