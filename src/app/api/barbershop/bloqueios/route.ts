import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const barberId = searchParams.get("barberId");

    const where: Record<string, unknown> = {};

    if (payload.role === "BARBER") {
      const barber = await prisma.barber.findUnique({ where: { userId: payload.id } });
      if (!barber) return NextResponse.json({ bloqueios: [] });
      where.barberId = barber.id;
    } else if (barberId) {
      where.barberId = barberId;
    } else {
      // Owner sem filtro: traz todos da barbearia
      const barbers = await prisma.barber.findMany({
        where: { barbershopId: payload.barbershopId! },
        select: { id: true },
      });
      where.barberId = { in: barbers.map((b) => b.id) };
    }

    if (date) {
      const d = new Date(date); d.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      where.date = { gte: d, lte: end };
    }

    const bloqueios = await prisma.scheduleBlock.findMany({
      where,
      include: { barber: { include: { user: { select: { name: true } } } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ bloqueios });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const { barberId: bodyBarberId, date, startTime, endTime, reason } = await req.json();

    let barberId = bodyBarberId;

    if (payload.role === "BARBER") {
      const barber = await prisma.barber.findUnique({ where: { userId: payload.id } });
      if (!barber) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
      barberId = barber.id;
    }

    const bloqueio = await prisma.scheduleBlock.create({
      data: {
        barberId,
        date: new Date(date),
        startTime,
        endTime,
        reason: reason || null,
      },
    });

    return NextResponse.json({ bloqueio }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
