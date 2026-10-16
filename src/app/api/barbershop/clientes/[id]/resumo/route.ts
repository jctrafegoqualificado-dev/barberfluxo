import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/barbershop/clientes/[id]/resumo
 *
 * Resumo do cliente para o painel de detalhes da agenda: visitas concluídas nesta
 * barbearia, última visita, as 3 mais recentes e a observação da barbearia.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;

    const client = await prisma.user.findFirst({
      where: {
        id,
        role: "CLIENT",
        OR: [{ appointments: { some: { barbershopId } } }, { subscriptions: { some: { barbershopId } } }],
      },
      select: { id: true },
    });
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const today = new Date(new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date()) + "T00:00:00Z");
    const doneWhere = { barbershopId, clientId: id, status: "DONE" };

    const [visits, recent, note] = await Promise.all([
      prisma.appointment.count({ where: doneWhere }),
      prisma.appointment.findMany({
        where: { ...doneWhere, date: { lt: today } },
        orderBy: [{ date: "desc" }, { startTime: "desc" }],
        take: 3,
        select: {
          date: true,
          service: { select: { name: true } },
          services: { select: { service: { select: { name: true } } } },
          barber: { select: { nickname: true, user: { select: { name: true } } } },
        },
      }),
      prisma.clientNote.findUnique({
        where: { clientId_barbershopId: { clientId: id, barbershopId } },
        select: { content: true },
      }),
    ]);

    return NextResponse.json({
      visits,
      lastVisit: recent[0]?.date ?? null,
      recent: recent.map((a) => ({
        date: a.date,
        services: a.services.length > 0 ? a.services.map((s) => s.service.name).join(" + ") : a.service?.name ?? "Serviço",
        barberName: a.barber.nickname || a.barber.user.name.split(" ")[0],
      })),
      note: note?.content ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
