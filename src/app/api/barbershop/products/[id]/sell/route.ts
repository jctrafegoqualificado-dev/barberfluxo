import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;
    const { quantity, clientId, paymentMethod } = await req.json();
    const qty = Number(quantity) || 1;

    // 1. Valida posse e busca estoque
    const product = await prisma.product.findFirst({ where: { id, barbershopId } });
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
        barbershopId,
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

    // 2. Integração com Fluxo de Caixa (Opcional, apenas se houver caixa aberto)
    if (paymentMethod) {
      const openSession = await prisma.cashFlowSession.findFirst({
        where: { barbershopId, status: "OPEN" },
        orderBy: { openedAt: "desc" }
      });
      if (openSession) {
        await prisma.cashFlowEntry.create({
          data: {
            sessionId: openSession.id,
            type: "INCOME",
            description: `Venda: ${qty}x ${product.name}`,
            amount: product.price * qty,
            category: "VENDA_PRODUTO",
            paymentMethod: paymentMethod || "CASH",
          }
        });
      }
    }

    return NextResponse.json({ sale }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
