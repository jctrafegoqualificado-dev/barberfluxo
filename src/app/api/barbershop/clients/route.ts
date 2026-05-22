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

    const phoneDigits = q.replace(/\D/g, "");
    const clients = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { appointments: { some: { barbershopId } } },
              { subscriptions: { some: { barbershopId } } },
            ],
          },
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              ...(phoneDigits.length > 0 ? [{ phone: { contains: phoneDigits } }] : []),
            ],
          },
        ],
      },
      select: { id: true, name: true, phone: true, email: true },
      take: 8,
      orderBy: { name: "asc" },
    });

    const res = NextResponse.json({ clients });
    res.headers.set("Cache-Control", "private, no-cache");
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
