import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";
import { ensureSaasPlansSeeded } from "@/lib/saasPlans.server";
import { SAAS_PLANS, type SaasPlanKey } from "@/lib/saasPlans";

// GET /api/plataforma/plans — lista a configuração editável dos planos.
// Semeia a tabela a partir dos defaults na primeira abertura (idempotente).
export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    await ensureSaasPlansSeeded();

    const plans = await (prisma as any).saasPlanConfig.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ plans });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Erro interno" : msg }, { status });
  }
}

// PUT /api/plataforma/plans — edita um plano (preço/nome/descrição/flags).
export async function PUT(req: NextRequest) {
  try {
    const payload = await requirePlatformAdmin(req);
    const body = await req.json();
    const { key, label, tagline, monthlyPrice, annualPriceMonthly, isPaid, legacy, active } = body;

    if (!key || !(key in SAAS_PLANS)) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};

    if (label !== undefined) {
      if (typeof label !== "string" || !label.trim()) {
        return NextResponse.json({ error: "Nome do plano inválido" }, { status: 400 });
      }
      data.label = label.trim();
    }
    if (tagline !== undefined) {
      data.tagline = typeof tagline === "string" ? tagline.trim() : "";
    }
    if (monthlyPrice !== undefined) {
      const n = Number(monthlyPrice);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "Preço mensal inválido" }, { status: 400 });
      }
      data.monthlyPrice = n;
    }
    if (annualPriceMonthly !== undefined) {
      if (annualPriceMonthly === null || annualPriceMonthly === "") {
        data.annualPriceMonthly = null;
      } else {
        const n = Number(annualPriceMonthly);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: "Preço anual inválido" }, { status: 400 });
        }
        data.annualPriceMonthly = n;
      }
    }
    if (isPaid !== undefined) data.isPaid = !!isPaid;
    if (legacy !== undefined) data.legacy = !!legacy;
    if (active !== undefined) data.active = !!active;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    // Garante que a linha exista (caso GET ainda não tenha semeado)
    const def = SAAS_PLANS[key as SaasPlanKey];
    const before = await (prisma as any).saasPlanConfig.findUnique({ where: { key } });
    const plan = await (prisma as any).saasPlanConfig.upsert({
      where: { key },
      update: data,
      create: {
        key: def.key,
        label: def.label,
        tagline: def.tagline,
        monthlyPrice: def.monthlyPrice,
        annualPriceMonthly: def.annualPriceMonthly,
        isPaid: def.isPaid,
        legacy: def.legacy ?? false,
        ...data,
      },
    });

    void logAudit({
      userId: payload.id,
      userEmail: payload.email,
      userRole: payload.role,
      action: "UPDATE",
      entity: "SaasPlanConfig",
      entityId: key,
      diff: { before: before ?? null, after: data },
      ip: getClientIp(req),
    });

    return NextResponse.json({ plan });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Erro interno" : msg }, { status });
  }
}
