import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const barberId = searchParams.get("barberId");

    const where: Record<string, unknown> = { barbershopId };
    if (date) {
      const startOfDay = new Date(date + "T00:00:00Z");
      const endOfDay = new Date(date + "T23:59:59.999Z");
      where.date = { gte: startOfDay, lte: endOfDay };
    }
    if (barberId) where.barberId = barberId;
    if (payload.role === "BARBER") {
      const barber = await prisma.barber.findUnique({ where: { userId: payload.id } });
      if (barber) where.barberId = barber.id;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        barber: { include: { user: { select: { name: true } } } },
        service: true,
        subscription: { include: { plan: { select: { name: true } } } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    return NextResponse.json({ appointments });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    requireAuth(req, ["OWNER", "BARBER"]);
    const { id, status, paymentMethod } = await req.json();

    const updateData: Record<string, unknown> = { status };
    if (paymentMethod) updateData.paymentMethod = paymentMethod;

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: { subscription: true },
    });

    // Se finalizou E tem assinatura vinculada → incrementa uso da assinatura
    if (status === "DONE" && appointment.subscriptionId) {
      const sub = await prisma.subscription.findUnique({
        where: { id: appointment.subscriptionId },
        include: { plan: true },
      });

      if (sub) {
        const newUses = sub.usesThisCycle + 1;
        // Se ultrapassou o limite do plano, não deixa usar mais (opcional: bloquear no agendamento)
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { usesThisCycle: newUses },
        });
      }
    }

    return NextResponse.json({ appointment });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();
    const { clientName, clientPhone, barberId, serviceId, date, startTime, force } = body;

    if (!clientName || !clientPhone || !barberId || !serviceId || !date || !startTime) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
    }

    // Busca o serviço para pegar preço e duração
    const service = await prisma.service.findFirst({
      where: { id: serviceId, barbershopId },
    });

    if (!service) {
      return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });
    }

    // Encontra ou cria o cliente
    const phoneDigits = clientPhone.replace(/\D/g, "");
    let client = await prisma.user.findFirst({
      where: { phone: { contains: phoneDigits }, role: "CLIENT" },
    });

    if (!client) {
      const email = `${phoneDigits}@cliente.barberfluxo.com`;
      const hashed = "123456"; // default dummy password for shadow clients
      client = await prisma.user.create({
        data: { name: clientName, email, phone: clientPhone, password: hashed, role: "CLIENT" },
      });
    }

    // Calcula endTime com base na duração do serviço
    const [h, m] = startTime.split(":").map(Number);
    const endTotalMinutes = h * 60 + m + service.duration;
    const endH = Math.floor(endTotalMinutes / 60);
    const endM = endTotalMinutes % 60;
    const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

    // Cria a data (meio-dia para evitar fuso)
    const appointmentDate = new Date(date + "T12:00:00Z");

    // Validação de choque de horário (a menos que seja forçado)
    if (!force) {
      const conflict = await prisma.appointment.findFirst({
        where: {
          barberId,
          date: appointmentDate,
          status: { notIn: ["CANCELLED"] },
          OR: [
            {
              startTime: { lt: endTime },
              endTime: { gt: startTime }
            }
          ]
        }
      });

      if (conflict) {
        return NextResponse.json({ error: "CONFLICT", message: "O barbeiro já possui um agendamento neste horário." }, { status: 409 });
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        date: appointmentDate,
        startTime,
        endTime,
        price: service.price,
        clientId: client.id,
        barbershopId,
        barberId,
        serviceId,
        status: "CONFIRMED"
      },
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
