import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;
    const { name, description, price, billingCycle, maxUses, serviceIds, serviceQuantities, active, beneficiaryRules, commissionPercentage, allowedBarberIds } = await req.json();

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
      // Use new serviceQuantities format or fall back to legacy serviceIds
      const hasNewFormat = Array.isArray(serviceQuantities);
      const hasLegacyFormat = Array.isArray(serviceIds);
      if (hasNewFormat || hasLegacyFormat) {
        await tx.planService.deleteMany({ where: { planId: id } });
      }
      const svcData = hasNewFormat
        ? serviceQuantities.map((sq: { serviceId: string; quantity: number | null }) => ({
            serviceId: sq.serviceId,
            quantity: sq.quantity ?? null,
          }))
        : hasLegacyFormat
          ? serviceIds.map((sid: string) => ({ serviceId: sid, quantity: null }))
          : undefined;
      return tx.plan.update({
        where: { id },
        data: {
          name,
          description,
          price: price !== undefined ? Number(String(price).replace(",", ".")) : undefined,
          commissionPercentage: commissionPercentage !== undefined ? (commissionPercentage === "" || commissionPercentage === null ? null : Number(commissionPercentage)) : undefined,
          billingCycle,
          maxUses: maxUses === "" || maxUses === null || maxUses === undefined ? null : Number(maxUses),
          beneficiaryRules: beneficiaryRules !== undefined ? beneficiaryRules : undefined,
          active,
          ...(svcData && {
            planServices: {
              create: svcData,
            },
          }),
          ...(allowedBarberIds && Array.isArray(allowedBarberIds)
            ? {
                allowedBarbers: {
                  set: allowedBarberIds.map((bid: string) => ({ id: bid })),
                },
              }
            : {}),
        },
        include: { planServices: { include: { service: true } }, allowedBarbers: true },
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
