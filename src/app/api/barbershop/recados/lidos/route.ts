import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST — o barbeiro marca recados como lidos. Sem ids, marca todos os recados da barbearia.
export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["BARBER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json().catch(() => ({}));
    const ids: unknown = body?.ids;

    const barber = await prisma.barber.findUnique({ where: { userId: payload.id }, select: { id: true } });
    if (!barber) return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });

    // Só recados desta barbearia — impede marcar recado de outra loja.
    const notices = await prisma.teamNotice.findMany({
      where: {
        barbershopId,
        ...(Array.isArray(ids) ? { id: { in: ids.filter((x): x is string => typeof x === "string") } } : {}),
        reads: { none: { barberId: barber.id } },
      },
      select: { id: true },
    });
    if (notices.length > 0) {
      await prisma.teamNoticeRead.createMany({
        data: notices.map((n) => ({ noticeId: n.id, barberId: barber.id })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ marked: notices.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
