import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(req, ["OWNER"]);
    const { id } = await params;
    const { name, description, price, costPrice, stock, category, active } = await req.json();
    const product = await prisma.product.update({
      where: { id },
      data: { name, description, price: Number(price), costPrice: Number(costPrice), stock: Number(stock), category, active },
    });
    return NextResponse.json({ product });
  } catch (e: unknown) {
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(req, ["OWNER"]);
    const { id } = await params;
    await prisma.product.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}
