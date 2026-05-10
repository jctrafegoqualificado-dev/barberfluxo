import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const now = new Date();

    const sales = await prisma.productSale.findMany({
      where: {
        barbershopId: payload.barbershopId!,
        createdAt: { gte: startOfMonth(now), lte: endOfMonth(now) },
      },
      include: {
        product: { select: { name: true, category: true } },
        barber: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalMes = sales.reduce((s, v) => s + v.total, 0);
    const totalUnidades = sales.reduce((s, v) => s + v.quantity, 0);

    return NextResponse.json({ sales, totalMes, totalUnidades });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
