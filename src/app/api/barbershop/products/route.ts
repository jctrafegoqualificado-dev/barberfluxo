import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const products = await prisma.product.findMany({
      where: { barbershopId: payload.barbershopId!, active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ products });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { name, description, price, costPrice, stock, category } = await req.json();
    const product = await prisma.product.create({
      data: {
        name, description,
        price: Number(price),
        costPrice: Number(costPrice || 0),
        stock: Number(stock || 0),
        category: category || "GERAL",
        barbershopId: payload.barbershopId!,
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
