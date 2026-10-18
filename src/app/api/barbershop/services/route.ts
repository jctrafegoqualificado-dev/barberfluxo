import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { currentMonthSP, monthStartSP } from "@/lib/monthResult";

const ServiceSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional(),
  price: z.number({ invalid_type_error: "Preço inválido" }).positive("Preço deve ser positivo"),
  duration: z.number({ invalid_type_error: "Duração inválida" }).int().positive("Duração deve ser positiva"),
  imageUrl: z.string().url("URL inválida").optional().nullable(),
  commission: z.number().min(0).max(100).optional().nullable(),
  materialCost: z.number().min(0).optional(),
  onlineBooking: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const services = await prisma.service.findMany({
      where: { barbershopId },
      orderBy: { name: "asc" },
    });

    // ?stats=1 — quantas vezes cada serviço foi feito no mês e quanto rendeu (tela Serviços)
    let stats: Record<string, { count: number; revenue: number }> | undefined;
    let monthTotals: { services: number; appointments: number; revenue: number } | undefined;
    if (req.nextUrl.searchParams.get("stats") === "1") {
      const start = monthStartSP(currentMonthSP());
      const appts = await prisma.appointment.findMany({
        where: { barbershopId, status: "DONE", date: { gte: start } },
        select: { price: true, subscriptionId: true, serviceId: true, services: { select: { serviceId: true, price: true } } },
      });
      stats = {};
      monthTotals = { services: 0, appointments: appts.length, revenue: 0 };
      for (const a of appts) {
        const list = a.services.length > 0 ? a.services : a.serviceId ? [{ serviceId: a.serviceId, price: a.price }] : [];
        for (const it of list) {
          const cur = (stats[it.serviceId] ??= { count: 0, revenue: 0 });
          cur.count += 1;
          // Assinante: o serviço do plano não gera faturamento na hora
          if (!a.subscriptionId) cur.revenue += it.price;
          monthTotals.services += 1;
          if (!a.subscriptionId) monthTotals.revenue += it.price;
        }
      }
    }

    const res = NextResponse.json({ services, stats, monthTotals });
    // Sem cache: a lista é editada na própria tela (um max-age reexibia o valor antigo)
    res.headers.set("Cache-Control", "no-store");
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
    const { name, description, price, duration, imageUrl, commission, materialCost, onlineBooking } = parsed.data;
    const service = await prisma.service.create({
      data: {
        name,
        description,
        price,
        duration,
        imageUrl: imageUrl ?? null,
        commission: commission ?? null,
        materialCost: materialCost ?? 0,
        onlineBooking: onlineBooking ?? true,
        barbershopId,
      },
    });
    return NextResponse.json({ service }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
