import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { sendAppointmentConfirmation } from "@/lib/email";
import { sendWhatsApp } from "@/lib/zapi";
import { bookingRatelimit, getIp } from "@/lib/ratelimit";
import { getEntitlements } from "@/lib/entitlements";
import { sendWhatsAppNotification, notifyBarberNewAppointment, welcomeMessage } from "@/lib/notifications";
import { phoneVariants } from "@/lib/phone";
import { findClientOverlap, clientOverlapMessage } from "@/lib/appointments";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    // Rate limiting — 8 agendamentos por IP por barbearia a cada 10 minutos
    // Chave ip:slug evita que clientes de barbearias diferentes compartilhem cota
    const ip = getIp(req);
    const { success } = await bookingRatelimit.limit(`${ip}:${slug}`);
    if (!success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
        { status: 429 },
      );
    }
    const { clientName, clientPhone, barberId, serviceId, serviceIds, date, startTime, subscriptionId } =
      await req.json();
    // Gera email interno a partir do telefone para identificar cliente sem exigir email
    const cleanPhone = (clientPhone ?? "").replace(/\D/g, "") || "sem-telefone";
    const clientEmail = `${cleanPhone}@cliente.iadebarbearia.com`;

    const shop = await prisma.barbershop.findUnique({ where: { slug } });
    if (!shop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });

    // Paywall: barbearia sem plano ativo não recebe agendamento público.
    if (!getEntitlements(shop).hasAccess) {
      return NextResponse.json(
        { error: "Esta barbearia não está aceitando agendamentos no momento." },
        { status: 403 }
      );
    }

    // Aceita múltiplos serviços (serviceIds[]) ou um único (serviceId) por compatibilidade
    const ids: string[] = Array.isArray(serviceIds) && serviceIds.length > 0
      ? serviceIds
      : serviceId ? [serviceId] : [];
    if (ids.length === 0) return NextResponse.json({ error: "Serviço inválido" }, { status: 404 });

    const foundServices = await prisma.service.findMany({
      where: { id: { in: ids }, barbershopId: shop.id, active: true },
    });
    if (foundServices.length !== ids.length) {
      return NextResponse.json({ error: "Serviço inválido" }, { status: 404 });
    }
    // Preserva a ordem em que o cliente escolheu
    const services = ids.map((id) => foundServices.find((s) => s.id === id)!);
    const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const servicesLabel = services.map((s) => s.name).join(" + ");

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
      include: { user: { select: { name: true, phone: true } } },
    });

    // Busca por telefone primeiro (casando variações 55/9º dígito para não duplicar);
    // depois pelos e-mails sintéticos (múltiplos domínios históricos)
    let client = await prisma.user.findFirst({ where: { phone: { in: phoneVariants(clientPhone) }, role: "CLIENT" } })
      ?? await prisma.user.findUnique({ where: { email: clientEmail } })
      ?? await prisma.user.findFirst({ where: { email: `${cleanPhone}@cliente.barberfluxo` } })
      ?? await prisma.user.findFirst({ where: { email: `${cleanPhone}@cliente.barberfluxo.com` } })
      ?? await prisma.user.findFirst({ where: { email: `${cleanPhone}@cliente.barberapp` } });

    // Assinatura: nunca confiar no subscriptionId vindo do body. Ele é apenas uma
    // intenção do cliente; a assinatura válida é resolvida no servidor, exigindo que
    // pertença ao cliente identificado pelo telefone, seja desta barbearia e esteja
    // ACTIVE. Sem isso qualquer um poderia agendar usando a assinatura de outra pessoa.
    let validSubscriptionId: string | null = null;
    if (subscriptionId && client) {
      const sub = await prisma.subscription.findFirst({
        where: { id: subscriptionId, clientId: client.id, barbershopId: shop.id, status: "ACTIVE" },
        include: { plan: { select: { allowedBarbers: { select: { id: true } } } } },
      });
      if (sub) {
        if (sub.plan.allowedBarbers.length > 0 && !sub.plan.allowedBarbers.some((b) => b.id === barberId)) {
          return NextResponse.json(
            { error: "O profissional selecionado não está autorizado a atender por este plano." },
            { status: 400 }
          );
        }
        validSubscriptionId = sub.id;
      }
      // Não bateu (assinatura de outro cliente, de outra barbearia ou inativa):
      // segue como agendamento avulso, sem o benefício do plano.
    }

    // Bloqueio de inadimplente (opcional, por barbearia): se a barbearia ativou
    // blockOverdueEnabled, um cliente com assinatura em atraso (OVERDUE) não pode
    // agendar — nem como avulso — até regularizar. Desligado (padrão) = comportamento
    // atual: ele agenda normalmente, apenas sem o benefício do plano.
    if (client && shop.blockOverdueEnabled) {
      const overdueSub = await prisma.subscription.findFirst({
        where: { clientId: client.id, barbershopId: shop.id, status: "OVERDUE" },
        select: { id: true, plan: { select: { name: true } } },
      });
      if (overdueSub) {
        // Avisa o cliente por WhatsApp (número da própria barbearia) que ele está
        // em atraso e por isso não conseguiu agendar. Não trava a resposta se falhar.
        if (client.phone) {
          const firstName = client.name.split(" ")[0];
          const msg = [
            `Olá, ${firstName}! 👋`,
            ``,
            `Não foi possível concluir seu agendamento no(a) *${shop.name}* porque sua assinatura *${overdueSub.plan.name}* está *em atraso*.`,
            ``,
            `Regularize o pagamento com a barbearia para voltar a agendar. ✂️`,
          ].join("\n");
          await sendWhatsAppNotification(shop.id, client.phone, msg).catch(() => {});
        }
        return NextResponse.json(
          {
            error: "Sua assinatura está em atraso. Regularize o pagamento com a barbearia para voltar a agendar.",
            code: "SUBSCRIPTION_OVERDUE",
          },
          { status: 403 },
        );
      }
    }

    // Bloqueia double-booking: mesmo telefone + mesmo nome + agendamento futuro ativo
    // Assinantes são isentos pois agendam regularmente
    if (client && !validSubscriptionId) {
      const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
      if (normalize(client.name) === normalize(clientName)) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existingAppt = await prisma.appointment.findFirst({
          where: {
            barbershopId: shop.id,
            clientId: client.id,
            status: { in: ["CONFIRMED", "PENDING"] },
            date: { gte: today },
          },
          select: { date: true, startTime: true },
        });
        if (existingAppt) {
          const [ano, mes, dia] = existingAppt.date.toISOString().split("T")[0].split("-");
          return NextResponse.json(
            { error: `Você já tem um agendamento marcado para ${dia}/${mes}/${ano} às ${existingAppt.startTime}. Cancele-o primeiro para fazer um novo.` },
            { status: 409 }
          );
        }
      }
    }

    const isNewClient = !client; // primeiro cadastro deste cliente → recebe boas-vindas
    if (!client) {
      const hashed = await hashPassword(clientPhone || "client123");
      client = await prisma.user.create({
        data: { name: clientName, email: clientEmail, phone: cleanPhone, password: hashed, role: "CLIENT" },
      });
    }

    const [h, m] = startTime.split(":").map(Number);
    const endMin = h * 60 + m + totalDuration;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

    // A trava acima é mais ampla, mas isenta assinantes e só age quando o nome
    // digitado bate com o cadastrado. Sobreposição de horário não pode escapar
    // por nenhuma dessas frestas: ninguém senta em duas cadeiras ao mesmo tempo.
    const overlap = await findClientOverlap({
      clientId: client.id,
      barbershopId: shop.id,
      date: new Date(date + "T12:00:00Z"),
      startTime,
      endTime,
    });
    if (overlap) {
      return NextResponse.json({ error: clientOverlapMessage(overlap) }, { status: 409 });
    }

    const appointment = await prisma.appointment.create({
      data: {
        // Meio-dia UTC: normaliza o campo `date` para o DIA agendado, evitando que
        // o fuso do Brasil (UTC-3) "volte um dia" ao exibir (ex.: comissões). (bug fuso)
        date: new Date(date + "T12:00:00Z"),
        startTime,
        endTime,
        price: totalPrice,
        clientId: client.id,
        barbershopId: shop.id,
        barberId,
        serviceId: services[0].id, // Legado: primeiro serviço para retrocompatibilidade
        status: "CONFIRMED",
        ...(validSubscriptionId ? { subscriptionId: validSubscriptionId } : {}),
        services: {
          create: services.map((s) => ({ serviceId: s.id, price: s.price, duration: s.duration })),
        },
      },
    });

    const [ano, mes, dia] = date.split("-");
    const dataFormatada = `${dia}/${mes}/${ano}`;

    // Notificação WhatsApp para o barbeiro (fonte única — via instância da barbearia, respeita toggle)
    void notifyBarberNewAppointment({
      barbershopId: shop.id,
      barberId,
      clientName: client.name,
      dateLabel: dataFormatada,
      startTime,
      servicesLabel,
    });

    // Confirmação WhatsApp para o cliente (cliente novo recebe boas-vindas junto, no mesmo envio)
    if (client.phone) {
      const confirm = [
        `Agendamento Confirmado - ${shop.name}`,
        ``,
        `Ola, ${client.name.split(" ")[0]}! Seu horario foi confirmado.`,
        ``,
        `Servico: ${servicesLabel}`,
        `Barbeiro: ${barber?.user.name ?? ""}`,
        `Data: ${dataFormatada}`,
        `Horario: ${startTime}`,
        ``,
        `Te esperamos la!`,
      ].join("\n");
      const msg = isNewClient ? `${welcomeMessage(shop.name, client.name)}\n\n${confirm}` : confirm;
      sendWhatsApp(client.phone, msg).catch(console.error);
    }

    // Envia email de confirmação (não bloqueia a resposta)
    sendAppointmentConfirmation({
      to: client.email,
      clientName: client.name,
      shopName: shop.name,
      serviceName: servicesLabel,
      barberName: barber?.user.name ?? "Barbeiro",
      date,
      time: startTime,
      isSubscriber: !!validSubscriptionId,
    }).catch(console.error);

    return NextResponse.json({ appointment, message: "Agendamento confirmado!" }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
