import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { phoneVariants } from "@/lib/phone";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();

    if (q.length < 2) return NextResponse.json({ clients: [] });

    const phoneDigits = q.replace(/\D/g, "");
    // Reconhecimento por telefone tolerante a variações do mesmo número
    // (com/sem DDI 55, com/sem 9º dígito) — sem isso, digitar "41998276617"
    // não acha um cadastro salvo como "554198276617".
    const variants = phoneDigits.length >= 10 ? phoneVariants(q) : [];
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
              ...(variants.length > 0 ? [{ phone: { in: variants } }] : []),
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
