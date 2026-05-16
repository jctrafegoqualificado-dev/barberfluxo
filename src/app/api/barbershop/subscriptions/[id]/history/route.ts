import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const { id } = await params;

    const history = await prisma.appointment.findMany({
      where: {
        subscriptionId: id,
        barbershopId: payload.barbershopId!,
        status: "DONE",
      },
      include: {
        barber: { include: { user: { select: { name: true } } } },
        services: { include: { service: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ history });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao carregar histórico";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
