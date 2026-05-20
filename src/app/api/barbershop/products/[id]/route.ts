import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;
    const { name, description, price, costPrice, stock, barcode, category, active, commissionType, commissionValue } = await req.json();

    // 1. Valida posse com findFirst (cruza barbershopId)
    const existing = await prisma.product.findFirst({ 
      where: { id, barbershopId },
      select: { id: true }
    });
    if (!existing) {
      return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    // 2. Update direto
    const product = await prisma.product.update({
      where: { id },
      data: {
        name, description, price: Number(price), costPrice: Number(costPrice), stock: Number(stock), barcode: barcode || null, category, active,
        commissionType: commissionType || "PERCENTAGE",
        commissionValue: Number(commissionValue || 10)
      },
    });

    return NextResponse.json({ product });
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

    const result = await prisma.product.updateMany({
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
