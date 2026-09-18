/**
 * Contagem de serviços em atendimentos de assinante (pool / POE).
 *
 * Um atendimento pode ter vários serviços (ex.: Corte + Barba). Para dividir o pool
 * de assinaturas, cada serviço DO PLANO realizado conta 1 — a barba vale o mesmo que
 * o corte. Serviços fora do plano já são cobrados à parte como extra (`extraPrice`)
 * e comissionados como avulso, por isso não entram nesta contagem.
 *
 * Todas as telas (comissões, financeiro, indicadores, produção e dashboard do barbeiro)
 * devem usar estas funções para que os números batam entre si.
 */

type ServiceInfo = { id: string; name: string; materialCost?: number | null };

export type SubscriptionAppt = {
  price: number;
  extraPrice?: number | null;
  service?: ServiceInfo | null;
  services?: { service: ServiceInfo }[] | null;
  subscription?: {
    plan?: {
      commissionPercentage?: number | null;
      planServices?: { serviceId: string }[] | null;
    } | null;
  } | null;
};

/** Campos que as consultas de atendimentos de assinante precisam carregar (usar em `include`). */
export const SUBSCRIPTION_APPT_INCLUDE = {
  service: { select: { id: true, name: true, materialCost: true } },
  services: { select: { service: { select: { id: true, name: true, materialCost: true } } } },
  subscription: {
    select: {
      plan: { select: { name: true, commissionPercentage: true, planServices: { select: { serviceId: true } } } },
    },
  },
} as const;

function performedServices(appt: SubscriptionAppt): ServiceInfo[] {
  if (appt.services && appt.services.length > 0) return appt.services.map((s) => s.service);
  return appt.service ? [appt.service] : [];
}

/** Serviços realizados no atendimento que fazem parte do plano do assinante. */
export function planServicesPerformed(appt: SubscriptionAppt): ServiceInfo[] {
  const planIds = new Set(appt.subscription?.plan?.planServices?.map((ps) => ps.serviceId) ?? []);
  return performedServices(appt).filter((s) => planIds.has(s.id));
}

/**
 * Quantos serviços do plano o atendimento consumiu.
 * Nunca menos que 1: todo atendimento de assinante concluído já abate um uso do plano
 * (e é assim que ele era contado antes desta regra).
 */
export function countPlanServices(appt: SubscriptionAppt): number {
  return Math.max(1, planServicesPerformed(appt).length);
}

/** Total de serviços do plano num conjunto de atendimentos — denominador do ticket do pool. */
export function totalPlanServices(appts: SubscriptionAppt[]): number {
  return appts.reduce((s, a) => s + countPlanServices(a), 0);
}

/** Nome para exibição, ex.: "Corte + Barba". */
export function planServicesLabel(appt: SubscriptionAppt): string {
  const list = planServicesPerformed(appt);
  if (list.length > 0) return list.map((s) => s.name).join(" + ");
  return appt.service?.name ?? "—";
}

/** Valor do plano no atendimento (preço sem o extra, que é acertado como avulso). */
export function baseSubscriptionPrice(appt: SubscriptionAppt): number {
  return Math.max(0, appt.price - (appt.extraPrice ?? 0));
}

/**
 * Comissão do barbeiro por um atendimento de assinante.
 * - Plano com comissão própria (%): % sobre o valor do plano menos o custo de material
 *   de todos os serviços do plano realizados.
 * - Senão: ticket do pool × quantidade de serviços do plano realizados.
 */
export function subscriptionCommission(appt: SubscriptionAppt, ticketPorServico: number): number {
  const customPct = appt.subscription?.plan?.commissionPercentage;
  if (customPct != null) {
    const materialCost = planServicesPerformed(appt).reduce((s, x) => s + (x.materialCost || 0), 0);
    const netValue = Math.max(0, baseSubscriptionPrice(appt) - materialCost);
    return netValue * (customPct / 100);
  }
  return ticketPorServico * countPlanServices(appt);
}
