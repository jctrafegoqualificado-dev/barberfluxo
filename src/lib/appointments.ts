import { prisma } from "./prisma";

/** "HH:MM" → minutos desde a meia-noite. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** minutos desde a meia-noite → "HH:MM". */
export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export interface ClientOverlap {
  id: string;
  startTime: string;
  endTime: string;
  barberName: string;
}

/**
 * Procura um agendamento do MESMO cliente que se sobreponha à janela pedida,
 * independentemente do barbeiro.
 *
 * A checagem de conflito que já existia olhava só a agenda de um barbeiro, então
 * o mesmo cliente conseguia reservar o mesmo horário com dois profissionais
 * diferentes — e os três caminhos de criação (site, bot do WhatsApp e painel)
 * deixavam passar. Na prática o cliente ia a um e faltava no outro, queimando a
 * cadeira do segundo barbeiro.
 *
 * CANCELLED e NO_SHOW ficam de fora: nesses casos o cliente não está ocupado.
 */
export async function findClientOverlap(params: {
  clientId: string;
  barbershopId: string;
  date: Date;
  startTime: string;
  endTime: string;
  /** Ignora o próprio agendamento ao remarcar. */
  excludeAppointmentId?: string;
}): Promise<ClientOverlap | null> {
  const { clientId, barbershopId, date, startTime, endTime, excludeAppointmentId } = params;

  const sameDay = await prisma.appointment.findMany({
    where: {
      clientId,
      barbershopId,
      date,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      barber: { select: { nickname: true, user: { select: { name: true } } } },
    },
  });

  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const hit = sameDay.find(
    (a) => start < toMinutes(a.endTime) && end > toMinutes(a.startTime)
  );
  if (!hit) return null;

  return {
    id: hit.id,
    startTime: hit.startTime,
    endTime: hit.endTime,
    barberName: hit.barber.nickname || hit.barber.user.name,
  };
}

/** Mensagem padrão mostrada ao cliente quando a sobreposição é recusada. */
export function clientOverlapMessage(overlap: ClientOverlap): string {
  return `Você já tem um horário às ${overlap.startTime} com ${overlap.barberName}. Cancele esse agendamento antes de marcar outro no mesmo horário.`;
}
