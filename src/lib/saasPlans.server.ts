/**
 * saasPlans.server.ts — camada SERVER da fonte de planos do SaaS.
 *
 * Lê a configuração editável da tabela SaasPlanConfig (preenchida via a aba
 * "Planos" do /plataforma) e mescla sobre os defaults estáticos de saasPlans.ts.
 * Se a tabela estiver vazia ou indisponível, cai no fallback estático — o
 * fluxo de cobrança nunca quebra por isso.
 *
 * NÃO importe este arquivo em client components (usa Prisma). Componentes de
 * UI devem buscar via GET /api/plans.
 */

import { prisma } from "./prisma";
import { SAAS_PLANS, type SaasPlanKey, type SaasPlanDef } from "./saasPlans";

type PlansMap = Record<SaasPlanKey, SaasPlanDef>;

// Ordem de exibição padrão usada na semeadura.
const DEFAULT_SORT: Record<SaasPlanKey, number> = { BASIC: 0, PRO: 1, ELITE: 2, PREMIUM: 3 };

/**
 * Carrega os planos com os valores do banco sobrepostos aos defaults.
 * Fallback total nos defaults estáticos em caso de erro/tabela vazia.
 */
export async function loadSaasPlans(): Promise<PlansMap> {
  try {
    const rows = await (prisma as any).saasPlanConfig.findMany();
    if (!rows?.length) return SAAS_PLANS;

    const merged: PlansMap = { ...SAAS_PLANS };
    for (const r of rows) {
      const key = r.key as SaasPlanKey;
      if (!(key in SAAS_PLANS)) continue; // ignora chaves desconhecidas
      merged[key] = {
        key,
        label: r.label,
        tagline: r.tagline ?? "",
        monthlyPrice: r.monthlyPrice,
        annualPriceMonthly: r.annualPriceMonthly ?? null,
        isPaid: r.isPaid,
        // hasAI é capacidade do produto (não editável pelo CEO) — vem sempre do default estático.
        hasAI: SAAS_PLANS[key].hasAI,
        legacy: r.legacy || undefined,
      };
    }
    return merged;
  } catch {
    return SAAS_PLANS;
  }
}

/**
 * Garante que a tabela tenha uma linha por plano (idempotente).
 * Chamada ao abrir a aba "Planos" no admin — semeia a partir dos defaults
 * sem sobrescrever valores já editados pelo CEO.
 */
export async function ensureSaasPlansSeeded(): Promise<void> {
  try {
    for (const def of Object.values(SAAS_PLANS) as SaasPlanDef[]) {
      await (prisma as any).saasPlanConfig.upsert({
        where: { key: def.key },
        update: {}, // não sobrescreve edições existentes
        create: {
          key: def.key,
          label: def.label,
          tagline: def.tagline,
          monthlyPrice: def.monthlyPrice,
          annualPriceMonthly: def.annualPriceMonthly,
          isPaid: def.isPaid,
          legacy: def.legacy ?? false,
          sortOrder: DEFAULT_SORT[def.key] ?? 0,
        },
      });
    }
  } catch (err) {
    console.warn("[saasPlans] seed falhou:", (err as Error).message);
  }
}
