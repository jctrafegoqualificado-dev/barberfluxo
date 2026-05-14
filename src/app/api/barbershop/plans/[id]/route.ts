import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { id } = await params;
    const { name, description, price, billingCycle, maxUses, serviceIds, active } = await req.json();

    const existing = await prisma.plan.findFirst({
      where: { id, barbershopId: payload.barbershopId! },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }

    const plan = await prisma.$transaction(async (tx) => {
      if (Array.isArray(serviceIds)) {
        await tx.planService.deleteMany({ where: { planId: id } });
      }
      return tx.plan.update({
        where: { id },
        data: {
          name,
          description,
          price: price !== undefined ? Number(price) : undefined,
          billingCycle,
          maxUses: maxUses === "" || maxUses === null || maxUses === undefined ? null : Number(maxUses),
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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { id } = await params;
    const existing = await prisma.plan.findFirst({
      where: { id, barbershopId: payload.barbershopId! },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }
    await prisma.plan.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
