import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};

    if (typeof body.poeDeductFees === "boolean") {
      updateData.poeDeductFees = body.poeDeductFees;
    }
    if (typeof body.poeSubscriptionFee === "number" && body.poeSubscriptionFee >= 0 && body.poeSubscriptionFee <= 100) {
      updateData.poeSubscriptionFee = body.poeSubscriptionFee;
    }
    if (typeof body.poeOwnerPct === "number" && body.poeOwnerPct >= 0 && body.poeOwnerPct <= 100) {
      updateData.poeOwnerPct = body.poeOwnerPct;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nenhum campo válido enviado" }, { status: 400 });
    }

    const updated = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: updateData,
      select: {
        poeOwnerPct: true,
        poeDeductFees: true,
        poeSubscriptionFee: true,
      },
    });

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
