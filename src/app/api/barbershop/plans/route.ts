import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const plans = await prisma.plan.findMany({
      where: { barbershopId: payload.barbershopId! },
      include: { planServices: { include: { service: true } } },
      orderBy: { price: "asc" },
    });
    return NextResponse.json({ plans });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { name, description, price, billingCycle, maxUses, serviceIds } = await req.json();

    const plan = await prisma.plan.create({
      data: {
        name,
        description,
        price: Number(price),
        billingCycle,
        maxUses: maxUses ? Number(maxUses) : null,
        barbershopId: payload.barbershopId!,
        planServices: {
          create: (serviceIds || []).map((sid: string) => ({ serviceId: sid })),
        },
      },
      include: { planServices: { include: { service: true } } },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
