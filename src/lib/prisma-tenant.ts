/**
 * prisma-tenant.ts — Cliente Prisma escopado por barbearia (H-3 Row-Level Security)
 *
 * Uso nas rotas:
 *   import { tenantPrisma } from "@/lib/prisma-tenant";
 *   const db = tenantPrisma(payload.barbershopId!);
 *   const records = await db.appointment.findMany({ where: { date: ... } });
 *   // ↑ barbershopId é injetado automaticamente — não é possível esquecer
 *
 * ─── Proteções automáticas ────────────────────────────────────────────────────
 *
 *   Leituras  (findMany · findFirst · findFirstOrThrow · count · aggregate · groupBy)
 *     → WHERE barbershopId = <id> injetado → tenant A nunca lê dados de tenant B
 *
 *   Escritas  (update · updateMany · delete · deleteMany)
 *     → WHERE barbershopId = <id> injetado → previne gravação cross-tenant
 *     → update/delete sem barbershopId no WHERE seria um no-op para registros de outro tenant
 *
 * ─── Operações SEM proteção automática (requer verificação manual) ─────────────
 *
 *   findUnique / findUniqueOrThrow
 *     Prisma exige chave única exata no WHERE; não aceita campos extras.
 *     Padrão seguro: `findFirst` com barbershopId, ou post-fetch `if (!r || r.barbershopId !== id)`.
 *
 *   create / createMany
 *     Sempre informe barbershopId explicitamente no data.
 *
 *   upsert
 *     Comportamento misto (create + update). Use com cautela.
 *
 * ─── Modelos cobertos ─────────────────────────────────────────────────────────
 *   Appointment · Barber · Service · Plan · Subscription · OpeningHour · SpecialDay
 *   Product · ProductSale · CommissionPayment · CommissionVale · Meta · Task
 *   WhatsAppContact · WhatsAppMessage · WhatsAppSession · Expense · CashFlowSession
 *   ApiKey · Review · LoyaltyPoint · AuditLog
 *
 * ─── Modelos SEM barbershopId (não cobertos, nem precisam) ───────────────────
 *   User · Barber (via userId) · Payment · ScheduleBlock · AppointmentService
 *   PlanService · WhatsAppInstance · CashFlowEntry
 */

import { prisma } from "./prisma";

/** Modelos com campo barbershopId direto no banco. */
const SCOPED_MODELS = new Set([
  "Appointment",
  "Barber",
  "Service",
  "Plan",
  "Subscription",
  "OpeningHour",
  "SpecialDay",
  "Product",
  "ProductSale",
  "CommissionPayment",
  "CommissionVale",
  "Meta",
  "Task",
  "WhatsAppContact",
  "WhatsAppMessage",
  "WhatsAppSession",
  "Expense",
  "CashFlowSession",
  "ApiKey",
  "Review",
  "LoyaltyPoint",
  "AuditLog",
]);

/** Operações de leitura: injeta barbershopId no WHERE. */
const READ_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

/** Operações de escrita: injeta barbershopId no WHERE para prevenir cross-tenant. */
const WRITE_OPS = new Set(["update", "updateMany", "delete", "deleteMany"]);

/**
 * Retorna um cliente Prisma pré-escopado para a barbearia informada.
 *
 * Todas as queries de leitura e escrita nos modelos multi-tenant incluem
 * automaticamente `WHERE barbershopId = <id>`, tornando impossível
 * acessar ou alterar dados de outro tenant por omissão acidental.
 */
export function tenantPrisma(barbershopId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          // Passa direto para modelos sem barbershopId ou operações não cobertas
          if (
            !SCOPED_MODELS.has(model) ||
            (!READ_OPS.has(operation) && !WRITE_OPS.has(operation))
          ) {
            return query(args);
          }

          // Injeta barbershopId no WHERE sem sobrescrever filtros existentes
          return query({
            ...args,
            where: { ...(args.where ?? {}), barbershopId },
          });
        },
      },
    },
  });
}
