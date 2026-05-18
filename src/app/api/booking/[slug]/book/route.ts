import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { sendAppointmentConfirmation } from "@/lib/email";
import { sendWhatsApp } from "@/lib/zapi";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { clientName, clientPhone, barberId, serviceId, date, startTime, subscriptionId } =
      await req.json();
    // Gera email interno a partir do telefone para identificar cliente sem exigir email
    const cleanPhone = (clientPhone ?? "").replace(/\D/g, "") || "sem-telefone";
    const clientEmail = `${cleanPhone}@cliente.barberfluxo`;

    const shop = await prisma.barbershop.findUnique({ where: { slug } });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return NextResponse.json({ error: "Serviço inválido" }, { status: 404 });

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
      include: { user: { select: { name: true, phone: true } } },
    });

    if (subscriptionId) {
      const sub = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: { include: { allowedBarbers: true } } },
      });
      if (sub && sub.plan.allowedBarbers.length > 0) {
        const isAllowed = sub.plan.allowedBarbers.some((b) => b.id === barberId);
        if (!isAllowed) {
          return NextResponse.json(
            { error: "O profissional selecionado não está autorizado a atender por este plano." },
            { status: 400 }
          );
        }
      }
    }

    let client = await prisma.user.findUnique({ where: { email: clientEmail } });
    if (!client) {
      const hashed = await hashPassword(clientPhone || "client123");
      client = await prisma.user.create({
        data: { name: clientName, email: clientEmail, phone: clientPhone, password: hashed, role: "CLIENT" },
      });
    }

    const [h, m] = startTime.split(":").map(Number);
    const endMin = h * 60 + m + service.duration;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

    const appointment = await prisma.appointment.create({
      data: {
        date: new Date(date),
        startTime,
        endTime,
        price: service.price,
        clientId: client.id,
        barbershopId: shop.id,
        barberId,
        serviceId,
        status: "CONFIRMED",
        ...(subscriptionId ? { subscriptionId } : {}),
      },
    });

    const [ano, mes, dia] = date.split("-");
    const dataFormatada = `${dia}/${mes}/${ano}`;

    // Notificação WhatsApp para o barbeiro
    if (barber?.user.phone) {
      const msg = `Novo Agendamento - ${shop.name}\n\nCliente: ${client.name}\nData: ${dataFormatada}\nHorario: ${startTime}\nServico: ${service.name}`;
      sendWhatsApp(barber.user.phone, msg).catch(console.error);
    }

    // Confirmação WhatsApp para o cliente
    if (client.phone) {
      const msg = [
        `Agendamento Confirmado - ${shop.name}`,
        ``,
        `Ola, ${client.name.split(" ")[0]}! Seu horario foi confirmado.`,
        ``,
        `Servico: ${service.name}`,
        `Barbeiro: ${barber?.user.name ?? ""}`,
        `Data: ${dataFormatada}`,
        `Horario: ${startTime}`,
        ``,
        `Te esperamos la!`,
      ].join("\n");
      sendWhatsApp(client.phone, msg).catch(console.error);
    }

    // Envia email de confirmação (não bloqueia a resposta)
    sendAppointmentConfirmation({
      to: client.email,
      clientName: client.name,
      shopName: shop.name,
      serviceName: service.name,
      barberName: barber?.user.name ?? "Barbeiro",
      date,
      time: startTime,
      isSubscriber: !!subscriptionId,
    }).catch(console.error);

    return NextResponse.json({ appointment, message: "Agendamento confirmado!" }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
