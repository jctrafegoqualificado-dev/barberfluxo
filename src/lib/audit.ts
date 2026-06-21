/**
 * audit.ts — Registro de ações sensíveis para trilha de auditoria (H-2)
 *
 * Fire-and-forget: erros de gravação não afetam a operação principal.
 * Todos os registros ficam em AuditLog com barbershopId para isolamento por tenant.
 *
 * Ações suportadas:
 *   CREATE | UPDATE | DELETE | CANCEL | STATUS_CHANGE | BLOCK | UNBLOCK | DEACTIVATE | ACTIVATE
 *
 * Entidades rastreadas:
 *   Appointment | Subscription | Plan | Barber | Client
 */

import { prisma } from "./prisma";
import { NextRequest } from "next/server";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "CANCEL"
  | "STATUS_CHANGE"
  | "BLOCK"
  | "UNBLOCK"
  | "DEACTIVATE"
  | "ACTIVATE"
  | "IMPERSONATE"
  | "GRANT_ACCESS"
  | "REVOKE_ACCESS"
  | "PLAN_CHANGE"
  | "MANUAL_PAYMENT";

export interface AuditParams {
  /** null/omitido para ações de plataforma sem barbearia (ex: gestão de admins) */
  barbershopId?: string;
  userId?:      string;
  userEmail?:   string;
  userRole?:    string;
  action:       AuditAction;
  entity:       string;
  entityId:     string;
  /** Campos relevantes antes/depois. Ex: { before: { status: "PENDING" }, after: { status: "DONE" } } */
  diff?: { before?: unknown; after?: unknown };
  ip?: string;
}

/**
 * Grava uma entrada de auditoria de forma assíncrona e silenciosa.
 * Use com `void logAudit(...)` para não bloquear a resposta ao cliente.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).auditLog.create({
      data: {
        barbershopId: params.barbershopId ?? null,
        userId:       params.userId   ?? null,
        userEmail:    params.userEmail ?? null,
        userRole:     params.userRole  ?? null,
        action:       params.action,
        entity:       params.entity,
        entityId:     params.entityId,
        diff:         params.diff     ?? null,
        ip:           params.ip       ?? null,
      },
    });
  } catch (err) {
    // Silencioso — nunca quebra a operação principal
    console.warn("[audit] logAudit falhou:", (err as Error).message);
  }
}

/**
 * Extrai o IP do cliente da requisição.
 * Em produção (Vercel / proxy reverso), usa x-forwarded-for.
 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
