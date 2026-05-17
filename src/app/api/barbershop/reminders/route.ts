import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: {
        reminderEnabled: true,
        reminderMinutes: true,
        reminderMessage: true,
      }
    });

    return NextResponse.json(barbershop);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();

    const updated = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        reminderEnabled: body.reminderEnabled ?? false,
        reminderMinutes: Number(body.reminderMinutes || 60),
        reminderMessage: body.reminderMessage || null,
      }
    });

    return NextResponse.json({
      reminderEnabled: updated.reminderEnabled,
      reminderMinutes: updated.reminderMinutes,
      reminderMessage: updated.reminderMessage,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
