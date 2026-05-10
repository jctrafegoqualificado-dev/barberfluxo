import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfDay, endOfDay } from "date-fns";

async function getBarber(userId: string) {
  return prisma.barber.findUnique({ where: { userId } });
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["BARBER", "OWNER"]);
    const barber = await getBarber(payload.id);
    if (!barber) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });

    const dateParam = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const d = new Date(dateParam + "T12:00:00");

    const blocks = await prisma.scheduleBlock.findMany({
      where: { barberId: barber.id, date: { gte: startOfDay(d), lte: endOfDay(d) } },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json({ blocks });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["BARBER", "OWNER"]);
    const barber = await getBarber(payload.id);
    if (!barber) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });

    const { date, startTime, endTime, reason } = await req.json();

    const block = await prisma.scheduleBlock.create({
      data: {
        barberId: barber.id,
        date: new Date(date + "T12:00:00"),
        startTime,
        endTime,
        reason: reason || null,
      },
    });

    return NextResponse.json({ block }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["BARBER", "OWNER"]);
    const barber = await getBarber(payload.id);
    if (!barber) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });

    const { id } = await req.json();
    await prisma.scheduleBlock.delete({ where: { id, barberId: barber.id } });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
