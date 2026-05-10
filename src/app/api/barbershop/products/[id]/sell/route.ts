import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const { id } = await params;
    const { quantity, clientId } = await req.json();
    const qty = Number(quantity) || 1;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    if (product.stock > 0 && product.stock < qty) {
      return NextResponse.json({ error: `Estoque insuficiente (${product.stock} disponível)` }, { status: 400 });
    }

    let barberId: string | null = null;
    if (payload.role === "BARBER") {
      const barber = await prisma.barber.findUnique({ where: { userId: payload.id } });
      barberId = barber?.id || null;
    }

    const sale = await prisma.productSale.create({
      data: {
        productId: id,
        barbershopId: payload.barbershopId!,
        barberId,
        clientId: clientId || null,
        quantity: qty,
        unitPrice: product.price,
        total: product.price * qty,
      },
      include: { product: true, barber: { include: { user: { select: { name: true } } } } },
    });

    if (product.stock > 0) {
      await prisma.product.update({ where: { id }, data: { stock: { decrement: qty } } });
    }

    return NextResponse.json({ sale }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
