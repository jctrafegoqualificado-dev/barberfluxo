import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(req, ["PLATFORM_ADMIN"]);
    const { id: shopId } = await params;
    const body = await req.json();
    const { amount, method, status = "PAID" } = body;

    if (!amount || !method) {
      return NextResponse.json({ error: "Valor e método são obrigatórios" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({ where: { id: shopId } });
    if (!shop) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const payment = await prisma.payment.create({
      data: {
        amount: Number(amount),
        method,
        status,
        paidAt: status === "PAID" ? new Date() : null,
        barbershopId: shopId,
      }
    });

    return NextResponse.json({ payment });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
