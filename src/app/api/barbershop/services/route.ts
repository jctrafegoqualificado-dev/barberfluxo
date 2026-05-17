import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const services = await prisma.service.findMany({
      where: { barbershopId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ services });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { name, description, price, duration, imageUrl, commission, materialCost } = await req.json();
    const service = await prisma.service.create({
      data: {
        name,
        description,
        price: Number(price),
        duration: Number(duration),
        imageUrl: imageUrl || null,
        commission: commission !== null && commission !== undefined ? Number(commission) : null,
        materialCost: Number(materialCost || 0),
        barbershopId
      },
    });
    return NextResponse.json({ service }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
