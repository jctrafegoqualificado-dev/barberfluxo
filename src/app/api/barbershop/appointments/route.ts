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
        services: { include: { service: { select: { id: true, name: true, price: true, duration: true } } } },
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
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();
    const { id, status, paymentMethod, serviceIds } = body;

    // ── Edição de serviços da comanda ──
    if (Array.isArray(serviceIds) && serviceIds.length > 0) {
      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds }, barbershopId, active: true },
      });
      if (services.length !== serviceIds.length) {
        return NextResponse.json({ error: "Um ou mais serviços não encontrados" }, { status: 404 });
      }

      const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
      const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

      const current = await prisma.appointment.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });

      const [h, m] = current.startTime.split(":").map(Number);
      const endMin = h * 60 + m + totalDuration;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

      await prisma.$transaction(async (tx) => {
        await tx.appointment.update({
          where: { id },
          data: {
            price: totalPrice,
            endTime,
            serviceId: services[0].id,
            ...(status ? { status } : {}),
            ...(paymentMethod ? { paymentMethod } : {}),
          },
        });
        await tx.appointmentService.deleteMany({ where: { appointmentId: id } });
        await tx.appointmentService.createMany({
          data: services.map((s) => ({
            appointmentId: id,
            serviceId: s.id,
            price: s.price,
            duration: s.duration,
          })),
        });
      });

      const updated = await prisma.appointment.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, name: true, phone: true } },
          barber: { include: { user: { select: { name: true } } } },
          service: true,
          subscription: true,
          services: { include: { service: { select: { id: true, name: true, price: true, duration: true } } } },
        },
      });
      return NextResponse.json({ appointment: updated });
    }

    // ── Fluxo original: status / pagamento ──
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: { subscription: true },
    });

    if (status === "DONE" && appointment.subscriptionId) {
      const sub = await prisma.subscription.findUnique({
        where: { id: appointment.subscriptionId },
        include: { plan: true },
      });
      if (sub) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { usesThisCycle: sub.usesThisCycle + 1 },
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
    const { clientName, clientPhone, barberId, serviceId, serviceIds, date, startTime, force } = body;

    // Aceita serviceIds (array multi-serviço) OU serviceId (legado, único)
    const ids: string[] = Array.isArray(serviceIds) && serviceIds.length > 0
      ? serviceIds
      : serviceId ? [serviceId] : [];

    if (!clientName || !clientPhone || !barberId || ids.length === 0 || !date || !startTime) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
    }

    // Busca todos os serviços selecionados
    const services = await prisma.service.findMany({
      where: { id: { in: ids }, barbershopId, active: true },
    });

    if (services.length !== ids.length) {
      return NextResponse.json({ error: "Um ou mais serviços não encontrados" }, { status: 404 });
    }

    // Calcula preço total e duração total
    const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

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

    // Calcula endTime com base na duração total de todos os serviços
    const [h, m] = startTime.split(":").map(Number);
    const endTotalMinutes = h * 60 + m + totalDuration;
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

    // Cria o agendamento com multi-serviço via transação
    const appointment = await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.create({
        data: {
          date: appointmentDate,
          startTime,
          endTime,
          price: totalPrice,
          clientId: client!.id,
          barbershopId,
          barberId,
          serviceId: services[0].id, // Legado: primeiro serviço para retrocompatibilidade
          status: "CONFIRMED",
        },
      });

      // Cria registros na junction table para cada serviço
      await tx.appointmentService.createMany({
        data: services.map((s) => ({
          appointmentId: appt.id,
          serviceId: s.id,
          price: s.price,
          duration: s.duration,
        })),
      });

      return appt;
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    requireAuth(req, ["OWNER", "BARBER"]);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID ausente" }, { status: 400 });

    await prisma.appointment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
