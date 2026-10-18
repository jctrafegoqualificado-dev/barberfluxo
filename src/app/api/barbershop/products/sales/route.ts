import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { currentMonthSP, monthStartSP } from "@/lib/monthResult";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);

    const sales = await prisma.productSale.findMany({
      where: {
        barbershopId: payload.barbershopId!,
        // Mês no fuso de São Paulo (no servidor UTC o mês começava às 21h do dia anterior)
        createdAt: { gte: monthStartSP(currentMonthSP()) },
      },
      include: {
        product: { select: { id: true, name: true, category: true, costPrice: true } },
        client: { select: { name: true } },
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
