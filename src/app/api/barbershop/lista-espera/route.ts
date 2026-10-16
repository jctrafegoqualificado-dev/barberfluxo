import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Lista de espera do dia, vista do painel. O dono/barbeiro pode chamar a pessoa
// manualmente ou tirá-la da fila. O aviso automático fica em src/lib/waitlist.ts.

function errorResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : "Erro interno";
  const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}

// GET ?date=AAAA-MM-DD
export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const date = req.nextUrl.searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Data inválida" }, { status: 400 });

    const entries = await prisma.waitlistEntry.findMany({
      where: { barbershopId: payload.barbershopId!, date, status: { in: ["WAITING", "NOTIFIED", "BOOKED"] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, clientName: true, clientPhone: true, anyBarber: true, status: true,
        notifiedAt: true, notifiedSlot: true, createdAt: true,
        barber: { select: { id: true, user: { select: { name: true } } } },
      },
    });
    return NextResponse.json({ entries });
  } catch (e: unknown) {
    return errorResponse(e);
  }
}

// DELETE ?id= — tira da fila (fica registrado como CANCELLED).
export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID ausente" }, { status: 400 });

    const result = await prisma.waitlistEntry.updateMany({
      where: { id, barbershopId: payload.barbershopId! },
      data: { status: "CANCELLED" },
    });
    if (result.count === 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return errorResponse(e);
  }
}
