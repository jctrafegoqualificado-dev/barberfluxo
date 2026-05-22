import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();

    if (q.length < 2) return NextResponse.json({ clients: [] });

    // Busca clientes que já tiveram agendamento nesta barbearia
    const appointments = await prisma.appointment.findMany({
      where: { barbershopId },
      select: { clientId: true },
      distinct: ["clientId"],
    });
    const clientIds = appointments.map((a) => a.clientId);

    const phoneDigits = q.replace(/\D/g, "");
    const clients = await prisma.user.findMany({
      where: {
        id: { in: clientIds },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          ...(phoneDigits.length > 0 ? [{ phone: { contains: phoneDigits } }] : []),
        ],
      },
      select: { id: true, name: true, phone: true, email: true },
      take: 8,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ clients });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
