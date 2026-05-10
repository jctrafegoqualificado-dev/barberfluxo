import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ subscriptionId: null });

  const shop = await prisma.barbershop.findUnique({ where: { slug }, select: { id: true } });
  if (!shop) return NextResponse.json({ subscriptionId: null });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ subscriptionId: null });

  const sub = await prisma.subscription.findFirst({
    where: { clientId: user.id, barbershopId: shop.id, status: "ACTIVE" },
    include: { plan: { select: { name: true, maxUses: true } } },
  });

  if (!sub) return NextResponse.json({ subscriptionId: null });

  return NextResponse.json({
    subscriptionId: sub.id,
    planName: sub.plan.name,
    usesThisCycle: sub.usesThisCycle,
    maxUses: sub.plan.maxUses,
  });
}
