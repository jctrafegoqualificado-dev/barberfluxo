import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const hours = await prisma.openingHour.findMany({
      where: { barbershopId: payload.barbershopId! },
      orderBy: { dayOfWeek: "asc" },
    });
    return NextResponse.json({ hours });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { hours } = await req.json() as {
      hours: { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }[];
    };

    await Promise.all(
      hours.map((h) =>
        prisma.openingHour.upsert({
          where: {
            barbershopId_dayOfWeek: { barbershopId, dayOfWeek: h.dayOfWeek },
          },
          update: { isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime },
          create: { barbershopId, dayOfWeek: h.dayOfWeek, isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
