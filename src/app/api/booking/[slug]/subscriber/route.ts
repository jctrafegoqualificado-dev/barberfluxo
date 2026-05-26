import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const email = req.nextUrl.searchParams.get("email");
  const phone = req.nextUrl.searchParams.get("phone");
  if (!email && !phone) return NextResponse.json({ subscriptionId: null });

  const shop = await prisma.barbershop.findUnique({ where: { slug }, select: { id: true } });
  if (!shop) return NextResponse.json({ subscriptionId: null });

  // Busca compatível com e-mail direto OU com múltiplos domínios sintéticos históricos
  const cleanPhone = phone ? phone.replace(/\D/g, "") : null;
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({
        where: {
          role: "CLIENT",
          OR: [
            { phone: cleanPhone! },
            { email: `${cleanPhone}@cliente.iadebarbearia.com` },
            { email: `${cleanPhone}@cliente.barberfluxo` },
            { email: `${cleanPhone}@cliente.barberfluxo.com` },
            { email: `${cleanPhone}@cliente.barberapp` },
          ],
        },
      });
  if (!user) return NextResponse.json({ subscriptionId: null });

  const sub = await prisma.subscription.findFirst({
    where: { clientId: user.id, barbershopId: shop.id, status: "ACTIVE" },
    include: { plan: { select: { name: true, maxUses: true, allowedBarbers: { select: { id: true } } } } },
  });

  if (!sub) return NextResponse.json({ subscriptionId: null });

  return NextResponse.json({
    subscriptionId: sub.id,
    planName: sub.plan.name,
    usesThisCycle: sub.usesThisCycle,
    maxUses: sub.plan.maxUses,
    allowedBarberIds: sub.plan.allowedBarbers.map((b: { id: string }) => b.id),
  });
}
