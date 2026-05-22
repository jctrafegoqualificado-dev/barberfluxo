import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

const ServiceSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional(),
  price: z.number({ invalid_type_error: "Preço inválido" }).positive("Preço deve ser positivo"),
  duration: z.number({ invalid_type_error: "Duração inválida" }).int().positive("Duração deve ser positiva"),
  imageUrl: z.string().url("URL inválida").optional().nullable(),
  commission: z.number().min(0).max(100).optional().nullable(),
  materialCost: z.number().min(0).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const services = await prisma.service.findMany({
      where: { barbershopId },
      orderBy: { name: "asc" },
    });
    const res = NextResponse.json({ services });
    res.headers.set("Cache-Control", "private, max-age=30");
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();
    const parsed = ServiceSchema.safeParse({
      ...body,
      price: body.price !== undefined ? Number(body.price) : undefined,
      duration: body.duration !== undefined ? Number(body.duration) : undefined,
      materialCost: body.materialCost !== undefined ? Number(body.materialCost) : undefined,
      commission: body.commission !== null && body.commission !== undefined ? Number(body.commission) : body.commission,
    });
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Dados inválidos";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { name, description, price, duration, imageUrl, commission, materialCost } = parsed.data;
    const service = await prisma.service.create({
      data: {
        name,
        description,
        price,
        duration,
        imageUrl: imageUrl ?? null,
        commission: commission ?? null,
        materialCost: materialCost ?? 0,
        barbershopId,
      },
    });
    return NextResponse.json({ service }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
