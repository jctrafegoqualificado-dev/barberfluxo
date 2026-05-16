import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;
    const { name, description, price, billingCycle, maxUses, serviceIds, active, beneficiaryRules } = await req.json();

    // 1. Valida posse
    const existing = await prisma.plan.findFirst({
      where: { id, barbershopId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    // 2. Update direto
    const plan = await prisma.$transaction(async (tx) => {
      if (Array.isArray(serviceIds)) {
        await tx.planService.deleteMany({ where: { planId: id } });
      }
      return tx.plan.update({
        where: { id },
        data: {
          name,
          description,
          price: price !== undefined ? Number(String(price).replace(",", ".")) : undefined,
          billingCycle,
          maxUses: maxUses === "" || maxUses === null || maxUses === undefined ? null : Number(maxUses),
          beneficiaryRules: beneficiaryRules !== undefined ? beneficiaryRules : undefined,
          active,
          ...(Array.isArray(serviceIds) && {
            planServices: {
              create: serviceIds.map((sid: string) => ({ serviceId: sid })),
            },
          }),
        },
        include: { planServices: { include: { service: true } } },
      });
    });

    return NextResponse.json({ plan });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;

    const result = await prisma.plan.updateMany({
      where: { id, barbershopId },
      data: { active: false }
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
