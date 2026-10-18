/**
 * Horário real (instante) de um agendamento.
 *
 * Appointment.date guarda só o dia ("AAAA-MM-DDT12:00:00Z") e startTime a hora local
 * da barbearia ("14:30", fuso de São Paulo). Montar com setHours() usa o fuso do
 * servidor — UTC na Vercel —, o que adiantava o horário em 3h.
 */
export function appointmentStartsAt(date: Date, startTime: string): Date {
  const day = date.toISOString().slice(0, 10);
  return new Date(`${day}T${startTime}:00-03:00`);
}
