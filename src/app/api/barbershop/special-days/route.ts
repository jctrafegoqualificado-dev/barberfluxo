import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const days = await prisma.specialDay.findMany({
      where: { barbershopId: payload.barbershopId! },
      orderBy: { date: "asc" },
    });
    return NextResponse.json({ days });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { date, isClosed, openTime, closeTime, reason } = await req.json();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }
    if (!isClosed && (!openTime || !closeTime)) {
      return NextResponse.json({ error: "Horário especial requer abertura e fechamento" }, { status: 400 });
    }

    const day = await prisma.specialDay.upsert({
      where: { barbershopId_date: { barbershopId: payload.barbershopId!, date } },
      create: { barbershopId: payload.barbershopId!, date, isClosed: !!isClosed, openTime: isClosed ? null : openTime, closeTime: isClosed ? null : closeTime, reason: reason || null },
      update: { isClosed: !!isClosed, openTime: isClosed ? null : openTime, closeTime: isClosed ? null : closeTime, reason: reason || null },
    });

    return NextResponse.json({ day });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
