/**
 * saasPlans.ts — Fonte ÚNICA da verdade dos planos do SaaS (IaDeBarbearia).
 *
 * Antes os preços e nomes estavam chumbados e DIVERGENTES em 6+ lugares
 * (ex: PRO = 147 no checkout recorrente vs 154,90 na UI). Todos os consumidores
 * — checkout, webhook, stats, telas de assinatura/cadastro/admin — devem importar
 * daqui. Quando os planos virarem editáveis (tabela no banco), só este arquivo
 * vira a camada de leitura; os consumidores não mudam.
 *
 * ⚠️ NÃO confundir com o `model Plan` do Prisma: aquele é o plano de assinatura
 * que a BARBEARIA vende aos clientes dela. Aqui é o plano do SaaS (o que a
 * barbearia paga para usar o IaDeBarbearia).
 */

export type SaasPlanKey = "BASIC" | "PRO" | "ELITE" | "PREMIUM";

export interface SaasPlanDef {
  key: SaasPlanKey;
  /** Nome comercial exibido ao cliente */
  label: string;
  tagline: string;
  /** Cobrança mensal (R$) no ciclo mensal */
  monthlyPrice: number;
  /** Preço mensal EQUIVALENTE no plano anual (a cobrança anual = este valor × 12). null = sem opção anual */
  annualPriceMonthly: number | null;
  /** Entra no MRR e desbloqueia recursos pagos */
  isPaid: boolean;
  /** Libera o assistente de IA conversacional (n8n). Só os planos "+ Assistente". */
  hasAI: boolean;
  /** Não é oferecido a novos clientes (mantido para assinantes existentes) */
  legacy?: boolean;
}

export const SAAS_PLANS: Record<SaasPlanKey, SaasPlanDef> = {
  BASIC: {
    key: "BASIC",
    label: "Básico",
    tagline: "Plano de entrada",
    monthlyPrice: 97,
    annualPriceMonthly: null,
    isPaid: false,
    hasAI: false,
  },
  PRO: {
    key: "PRO",
    label: "Gestão",
    tagline: "Gestão profissional completa",
    monthlyPrice: 154.9,
    annualPriceMonthly: 139.9,
    isPaid: true,
    hasAI: false,
  },
  ELITE: {
    key: "ELITE",
    label: "Gestão + Assistente",
    tagline: "Inteligência Artificial a seu favor",
    monthlyPrice: 197.9,
    annualPriceMonthly: 179.9,
    isPaid: true,
    hasAI: true,
  },
  PREMIUM: {
    key: "PREMIUM",
    label: "Gestão + Assistente",
    tagline: "Inteligência Artificial a seu favor",
    monthlyPrice: 197.9,
    annualPriceMonthly: 179.9,
    isPaid: true,
    hasAI: true,
    legacy: true, // equivale a ELITE
  },
};

export type BillingCycle = "monthly" | "annual";

/** Planos que contam como pagos (MRR / features pagas). */
export const PAID_PLANS: SaasPlanKey[] = (Object.values(SAAS_PLANS) as SaasPlanDef[])
  .filter((p) => p.isPaid)
  .map((p) => p.key);

const round2 = (n: number) => Math.round(n * 100) / 100;

export type PlansMap = Record<SaasPlanKey, SaasPlanDef>;

function getPlan(plan: string, plans: PlansMap = SAAS_PLANS): SaasPlanDef | undefined {
  return plans[plan as SaasPlanKey];
}

export function isPaidPlan(plan: string, plans: PlansMap = SAAS_PLANS): boolean {
  return getPlan(plan, plans)?.isPaid ?? false;
}

/** Preço mensal de um plano (0 se desconhecido). Usado no MRR. */
export function getMonthlyPrice(plan: string, plans: PlansMap = SAAS_PLANS): number {
  return getPlan(plan, plans)?.monthlyPrice ?? 0;
}

/**
 * Valor que deve ser cobrado no checkout para (plano, ciclo).
 * Anual = preço mensal equivalente × 12. Retorna null para plano não-pago/desconhecido.
 */
export function getCheckoutAmount(plan: string, cycle: BillingCycle, plans: PlansMap = SAAS_PLANS): number | null {
  const def = getPlan(plan, plans);
  if (!def || !def.isPaid) return null;
  if (cycle === "annual") {
    return def.annualPriceMonthly != null ? round2(def.annualPriceMonthly * 12) : null;
  }
  return def.monthlyPrice;
}

/**
 * Legado: deriva o plano a partir do valor pago, comparando com os preços
 * canônicos (mensal e anual). Substitui o threshold mágico `amount <= 170`.
 * Só retorna planos não-legados (PRO/ELITE).
 */
export function resolvePlanFromAmount(amount: number, plans: PlansMap = SAAS_PLANS): SaasPlanKey {
  let best: SaasPlanKey = "ELITE";
  let bestDist = Infinity;
  for (const key of PAID_PLANS) {
    if (plans[key].legacy) continue; // PREMIUM mapeia para ELITE
    for (const cycle of ["monthly", "annual"] as BillingCycle[]) {
      const expected = getCheckoutAmount(key, cycle, plans);
      if (expected == null) continue;
      const dist = Math.abs(expected - amount);
      if (dist < bestDist) {
        bestDist = dist;
        best = key;
      }
    }
  }
  return best;
}

/** Formata um valor em reais: 154.9 → "R$ 154,90". */
export function formatBRL(n: number): string {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}
