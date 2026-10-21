import { prisma } from "@/lib/prisma";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma;

/**
 * Quita UMA mensalidade de assinatura de cliente. Regra única para baixa manual e para os
 * avisos do Mercado Pago:
 * - o mesmo pagamento do MP (externalId/mpPaymentId) nunca entra duas vezes;
 * - quita só a cobrança pendente mais antiga (o cron cria uma por ciclo em atraso);
 *   sem pendente, registra o pagamento.
 * Antes o aviso do MP marcava TODAS as pendentes como pagas com um único pagamento
 * (3 meses em atraso pagos com R$ 100 viravam R$ 300 no pote dos barbeiros).
 *
 * Devolve "duplicate" quando o pagamento já tinha sido registrado: quem chama não deve
 * andar o vencimento de novo.
 */
export async function settleSubscriptionPayment(
  tx: Tx,
  input: {
    subscriptionId: string;
    barbershopId: string | null;
    amount: number;
    method: string;
    externalId?: string | null;
    mpPaymentId?: string | null;
    gatewayType?: string | null;
  },
): Promise<"duplicate" | "settled" | "created"> {
  const ids = [
    input.externalId ? { externalId: input.externalId } : null,
    input.mpPaymentId ? { mpPaymentId: input.mpPaymentId } : null,
  ].filter(Boolean) as { externalId?: string; mpPaymentId?: string }[];
  if (ids.length) {
    const already = await tx.payment.findFirst({
      where: { subscriptionId: input.subscriptionId, status: "PAID", OR: ids },
      select: { id: true },
    });
    if (already) return "duplicate";
  }

  const paid = {
    status: "PAID",
    method: input.method,
    paidAt: new Date(),
    ...(input.externalId ? { externalId: input.externalId } : {}),
    ...(input.mpPaymentId ? { mpPaymentId: input.mpPaymentId } : {}),
    ...(input.gatewayType ? { gatewayType: input.gatewayType } : {}),
  };
  const pending = await tx.payment.findFirst({
    where: { subscriptionId: input.subscriptionId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (pending) {
    await tx.payment.update({ where: { id: pending.id }, data: { ...paid, amount: input.amount, ...(input.barbershopId ? { barbershopId: input.barbershopId } : {}) } });
    return "settled";
  }
  await tx.payment.create({
    data: { ...paid, amount: input.amount, subscriptionId: input.subscriptionId, barbershopId: input.barbershopId },
  });
  return "created";
}
