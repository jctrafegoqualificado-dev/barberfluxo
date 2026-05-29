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
        retentionEnabled: true,
        retentionDays: true,
        retentionMessage: true,
      },
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

    const days = Number(body.retentionDays);

    const updated = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        retentionEnabled: body.retentionEnabled ?? false,
        retentionDays: days >= 7 && days <= 365 ? days : 45,
        retentionMessage: body.retentionMessage || null,
      },
    });

    return NextResponse.json({
      retentionEnabled: updated.retentionEnabled,
      retentionDays: updated.retentionDays,
      retentionMessage: updated.retentionMessage,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
