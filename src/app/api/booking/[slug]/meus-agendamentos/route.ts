import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    if (!phone || phone.replace(/\D/g, "").length < 8) {
      return NextResponse.json({ error: "Telefone inválido" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({
      where: { slug },
      select: { id: true, active: true },
    });
    if (!shop || !shop.active) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const cleanPhone = phone.replace(/\D/g, "");

    // Busca por phone limpo OU pelo email gerado (padrão do sistema de agendamento online)
    const clients = await prisma.user.findMany({
      where: {
        role: "CLIENT",
        OR: [
          { phone: cleanPhone },
          { email: `${cleanPhone}@cliente.barberfluxo` },
          { email: `${cleanPhone}@cliente.barberapp` },
        ],
      },
      select: { id: true, name: true },
    });

    if (clients.length === 0) {
      return NextResponse.json({ appointments: [] });
    }

    const clientIds = clients.map((c) => c.id);

    // Usa meia-noite UTC para bater com como as datas são salvas (new Date("YYYY-MM-DD") = UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const appointments = await prisma.appointment.findMany({
      where: {
        clientId: { in: clientIds },
        barbershopId: shop.id,
        date: { gte: today },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      include: {
        service: { select: { name: true } },
        barber: { include: { user: { select: { name: true } } } },
        services: { include: { service: { select: { name: true } } } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({
      clientName: clients[0].name,
      appointments: appointments.map((a) => ({
        id: a.id,
        date: a.date.toISOString().split("T")[0],
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        serviceName: a.services.length > 0
          ? a.services.map((s) => s.service.name).join(" + ")
          : a.service?.name ?? "Serviço",
        barberName: a.barber.user.name,
        price: a.price,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
