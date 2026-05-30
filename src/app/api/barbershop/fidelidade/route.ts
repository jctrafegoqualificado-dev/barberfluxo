import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const shop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { loyaltyThreshold: true, loyaltyDiscountPercent: true },
    });

    // Agrega pontos por cliente (EARNED positivo, REDEEMED negativo somado junto)
    const grouped = await prisma.loyaltyPoint.groupBy({
      by: ["clientId"],
      where: { barbershopId },
      _sum: { points: true },
    });

    if (grouped.length === 0) {
      return NextResponse.json({ clients: [], config: shop });
    }

    const clientIds = grouped.map((g) => g.clientId);
    const users = await prisma.user.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, phone: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const clients = grouped
      .map((g) => ({
        clientId: g.clientId,
        name: userMap.get(g.clientId)?.name ?? "—",
        phone: userMap.get(g.clientId)?.phone ?? null,
        balance: g._sum.points ?? 0,
      }))
      .filter((c) => c.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    return NextResponse.json({ clients, config: shop });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { clientId } = await req.json();

    if (!clientId) {
      return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { loyaltyThreshold: true, loyaltyDiscountPercent: true },
    });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    // Verifica saldo atual
    const agg = await prisma.loyaltyPoint.aggregate({
      where: { barbershopId, clientId },
      _sum: { points: true },
    });
    const balance = agg._sum.points ?? 0;

    if (balance < shop.loyaltyThreshold) {
      return NextResponse.json(
        { error: `Saldo insuficiente. Necessário: ${shop.loyaltyThreshold} pts, disponível: ${balance} pts.` },
        { status: 400 }
      );
    }

    const entry = await prisma.loyaltyPoint.create({
      data: {
        points: -shop.loyaltyThreshold,
        action: "REDEEMED",
        description: `Resgate: ${shop.loyaltyDiscountPercent}% de desconto`,
        clientId,
        barbershopId,
      },
    });

    return NextResponse.json({
      success: true,
      entry,
      discountPercent: shop.loyaltyDiscountPercent,
      newBalance: balance - shop.loyaltyThreshold,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
