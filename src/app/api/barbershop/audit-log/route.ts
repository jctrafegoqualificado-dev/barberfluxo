/**
 * GET /api/barbershop/audit-log
 *
 * Retorna a trilha de auditoria da barbearia (somente OWNER).
 *
 * Query params:
 *   page    — número da página (default 1)
 *   limit   — registros por página (default 50, máx 100)
 *   entity  — filtra por entidade: Appointment | Subscription | Plan | Barber | Client
 *   action  — filtra por ação: CREATE | UPDATE | DELETE | CANCEL | STATUS_CHANGE | BLOCK | ...
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { tenantPrisma } from "@/lib/prisma-tenant";

export async function GET(req: NextRequest) {
  try {
    const payload      = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { searchParams } = new URL(req.url);

    const page   = Math.max(1, Number(searchParams.get("page")  ?? 1));
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));
    const entity = searchParams.get("entity") ?? undefined;
    const action = searchParams.get("action") ?? undefined;
    const skip   = (page - 1) * limit;

    // tenantPrisma injeta barbershopId automaticamente (H-3)
    const db = tenantPrisma(barbershopId);

    const where: Record<string, unknown> = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [logs, total] = await Promise.all([
      (db as any).auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      (db as any).auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (e: unknown) {
    const msg    = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
