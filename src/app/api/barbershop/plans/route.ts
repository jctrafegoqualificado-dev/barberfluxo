import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const plans = await prisma.plan.findMany({
      where: { barbershopId: payload.barbershopId! },
      include: {
        planServices: { include: { service: true } },
        _count: { select: { subscriptions: true } }
      },
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
    const { name, description, price, billingCycle, maxUses, serviceIds, serviceQuantities, beneficiaryRules, commissionPercentage, allowedBarberIds } = await req.json();

    // serviceQuantities = [{ serviceId, quantity }] (new format)
    // serviceIds = ["id1", "id2"] (legacy fallback)
    const svcData = Array.isArray(serviceQuantities)
      ? serviceQuantities.map((sq: { serviceId: string; quantity: number | null }) => ({
          serviceId: sq.serviceId,
          quantity: sq.quantity ?? null,
        }))
      : (serviceIds || []).map((sid: string) => ({ serviceId: sid, quantity: null }));

    const plan = await prisma.plan.create({
      data: {
        name,
        description,
        price: Number(String(price).replace(",", ".")),
        commissionPercentage: commissionPercentage != null ? Number(commissionPercentage) : null,
        billingCycle,
        maxUses: maxUses ? Number(maxUses) : null,
        beneficiaryRules: beneficiaryRules || null,
        barbershopId: payload.barbershopId!,
        planServices: {
          create: svcData,
        },
        ...(allowedBarberIds && Array.isArray(allowedBarberIds) && allowedBarberIds.length > 0
          ? {
              allowedBarbers: {
                connect: allowedBarberIds.map((id: string) => ({ id })),
              },
            }
          : {}),
      },
      include: { planServices: { include: { service: true } }, allowedBarbers: true },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (e: unknown) {
    console.error("ERRO AO CRIAR PLANO:", e);
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
