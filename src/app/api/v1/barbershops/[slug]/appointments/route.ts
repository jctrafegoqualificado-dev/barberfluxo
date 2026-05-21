import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number) {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const clientPhone = searchParams.get("clientPhone");
    if (!clientPhone) {
      return NextResponse.json({ error: "Parâmetro clientPhone obrigatório" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({ where: { slug }, select: { id: true, active: true } });
    if (!shop || !shop.active) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const phoneDigits = onlyDigits(clientPhone);
    const now = new Date();

    const appointments = await prisma.appointment.findMany({
      where: {
        barbershopId: shop.id,
        status: { notIn: ["CANCELLED", "DONE", "NO_SHOW"] },
        date: { gte: now },
        client: { phone: { contains: phoneDigits } },
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        barber: { select: { id: true, nickname: true, user: { select: { name: true } } } },
        service: { select: { id: true, name: true, price: true, duration: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({
      appointments: appointments.map((a) => ({
        id: a.id,
        date: a.date.toISOString().slice(0, 10),
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        price: a.price,
        notes: a.notes,
        client: a.client,
        barber: { id: a.barber.id, name: a.barber.user.name, nickname: a.barber.nickname },
        service: a.service,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const { date, startTime, barberId, serviceId, clientPhone, clientName, notes, paymentMethod } = body;

    if (!date || !startTime || !barberId || !serviceId || !clientPhone || !clientName) {
      return NextResponse.json(
        { error: "Campos obrigatórios: date, startTime, barberId, serviceId, clientPhone, clientName" },
        { status: 400 }
      );
    }

    const shop = await prisma.barbershop.findUnique({ where: { slug }, select: { id: true, active: true } });
    if (!shop || !shop.active) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const [barber, service] = await Promise.all([
      prisma.barber.findFirst({
        where: { id: barberId, barbershopId: shop.id, active: true },
        select: { id: true, dayOff: true },
      }),
      prisma.service.findFirst({
        where: { id: serviceId, barbershopId: shop.id, active: true },
        select: { id: true, price: true, duration: true },
      }),
    ]);
    if (!barber) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
    if (!service) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });

    const dayStart = new Date(`${date}T00:00:00`);
    if (isNaN(dayStart.getTime())) {
      return NextResponse.json({ error: "Data inválida (use YYYY-MM-DD)" }, { status: 400 });
    }
    if (barber.dayOff === dayStart.getDay()) {
      return NextResponse.json({ error: "Barbeiro de folga nesse dia" }, { status: 409 });
    }

    const startMin = toMinutes(startTime);
    const endMin = startMin + service.duration;
    const endTime = toHHMM(endMin);

    const opening = await prisma.openingHour.findUnique({
      where: { barbershopId_dayOfWeek: { barbershopId: shop.id, dayOfWeek: dayStart.getDay() } },
    });
    if (!opening || !opening.isOpen) {
      return NextResponse.json({ error: "Barbearia fechada nesse dia" }, { status: 409 });
    }
    if (startMin < toMinutes(opening.openTime) || endMin > toMinutes(opening.closeTime)) {
      return NextResponse.json({ error: "Horário fora do funcionamento" }, { status: 409 });
    }

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const conflicts = await prisma.appointment.findMany({
      where: {
        barberId: barber.id,
        date: { gte: dayStart, lte: dayEnd },
        status: { not: "CANCELLED" },
      },
      select: { startTime: true, endTime: true },
    });
    const hasConflict = conflicts.some((c) => startMin < toMinutes(c.endTime) && endMin > toMinutes(c.startTime));
    if (hasConflict) {
      return NextResponse.json({ error: "Horário já reservado" }, { status: 409 });
    }

    const phoneDigits = onlyDigits(clientPhone);
    let client = await prisma.user.findFirst({
      where: { phone: { contains: phoneDigits }, role: "CLIENT" },
    });
    if (!client) {
      const placeholderEmail = `${phoneDigits}-${shop.id.slice(-6)}@whatsapp.local`;
      const tempPassword = await hashPassword(`bot-${phoneDigits}-${Date.now()}`);
      client = await prisma.user.create({
        data: {
          name: clientName,
          email: placeholderEmail,
          phone: phoneDigits,
          password: tempPassword,
          role: "CLIENT",
        },
      });
    }

    // Busca assinatura ativa do cliente para vincular ao agendamento
    let subscription = await prisma.subscription.findFirst({
      where: { clientId: client.id, status: "ACTIVE", barbershopId: shop.id },
      include: { plan: { include: { allowedBarbers: true } } },
    });

    if (subscription && subscription.plan.allowedBarbers.length > 0) {
      const isAllowed = subscription.plan.allowedBarbers.some((b) => b.id === barber.id);
      if (!isAllowed) {
        subscription = null; // Barbeiro não permitido pelo plano, trata como avulso
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        date: dayStart,
        startTime,
        endTime,
        status: "PENDING",
        price: service.price,
        paymentMethod: paymentMethod || "CASH",
        notes: notes || null,
        clientId: client.id,
        barbershopId: shop.id,
        barberId: barber.id,
        serviceId: service.id,
        subscriptionId: subscription?.id || null,
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        barber: { select: { id: true, nickname: true, user: { select: { name: true } } } },
        service: { select: { id: true, name: true, price: true, duration: true } },
      },
    });

    return NextResponse.json(
      {
        appointment: {
          id: appointment.id,
          date: appointment.date.toISOString().slice(0, 10),
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          status: appointment.status,
          price: appointment.price,
          paymentMethod: appointment.paymentMethod,
          notes: appointment.notes,
          client: appointment.client,
          barber: { id: appointment.barber.id, name: appointment.barber.user.name, nickname: appointment.barber.nickname },
          service: appointment.service,
        },
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
