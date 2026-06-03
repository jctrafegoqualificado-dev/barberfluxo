import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { sendWhatsAppNotification } from "@/lib/notifications";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { logAudit, getClientIp } from "@/lib/audit";

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
        subscription: { select: { id: true, status: true, plan: { select: { name: true } } } },
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
    const { id, status, paymentMethod, serviceIds, extraPrice, extraPaymentMethod, discountPercent } = body;

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
      if (!current || current.barbershopId !== barbershopId) {
        return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
      }

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

    // ── Mover agendamento (drag & drop) ──
    if (body.startTime !== undefined) {
      const current = await prisma.appointment.findUnique({
        where: { id },
        include: {
          client: { select: { name: true, phone: true } },
          barbershop: { select: { name: true } },
        },
      });
      if (!current || current.barbershopId !== barbershopId) {
        return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
      }
      const newBarberId: string = body.barberId || current.barberId;
      const [sh, sm] = (body.startTime as string).split(":").map(Number);
      const [csh, csm] = current.startTime.split(":").map(Number);
      const [ceh, cem] = current.endTime.split(":").map(Number);
      const duration = (ceh * 60 + cem) - (csh * 60 + csm);
      const endMins = sh * 60 + sm + duration;
      const newEndTime = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
      await prisma.appointment.update({
        where: { id },
        data: { startTime: body.startTime, endTime: newEndTime, barberId: newBarberId },
      });

      if (current.client.phone) {
        const dateFormatted = format(new Date(current.date), "dd/MM", { locale: ptBR });
        const rescheduleMsg = `🔄 *Agendamento Remarcado*\n\nOlá *${current.client.name.split(" ")[0]}*, seu horário no *${current.barbershop.name}* foi atualizado:\n\n🗓️ *${dateFormatted}* às *${body.startTime as string}*\n\nQualquer dúvida, entre em contato. Até lá! 💈`;
        sendWhatsAppNotification(barbershopId, current.client.phone, rescheduleMsg).catch(console.error);
      }

      return NextResponse.json({ success: true });
    }

    // ── Fluxo original: status / pagamento ──
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (body.price !== undefined) updateData.price = body.price;
    if (extraPaymentMethod) updateData.extraPaymentMethod = extraPaymentMethod;

    // Aplica desconto se informado:
    // - Para assinante: o front já envia extraPrice descontado; aqui só salvamos discountPercent
    // - Para não-assinante: aplicamos o desconto sobre o price atual do appointment
    if (discountPercent !== undefined && discountPercent > 0) {
      updateData.discountPercent = Math.min(100, Math.max(0, Number(discountPercent)));
    }
    if (extraPrice !== undefined) {
      updateData.extraPrice = Number(extraPrice); // já vem descontado do front
    }

    // Busca o estado ANTERIOR e valida posse do tenant em uma única query
    const previousState = await prisma.appointment.findUnique({
      where: { id },
      select: { status: true, barbershopId: true, price: true, subscriptionId: true },
    });
    if (!previousState || previousState.barbershopId !== barbershopId) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    // Aplica desconto ao price para clientes não-assinantes (extraPrice já vem descontado do front para assinantes)
    if (discountPercent !== undefined && discountPercent > 0 && !previousState.subscriptionId && body.price === undefined) {
      const discountedPrice = previousState.price * (1 - Number(discountPercent) / 100);
      updateData.price = Math.round(discountedPrice * 100) / 100;
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: { subscription: true, client: true, barbershop: true },
    });

    // ── DONE: Abate uso do plano (só se não era DONE antes — previne double-click) ──
    if (status === "DONE" && previousState?.status !== "DONE" && appointment.subscriptionId) {
      const sub = await prisma.subscription.findUnique({
        where: { id: appointment.subscriptionId },
      });

      if (sub) {
        if (appointment.beneficiaryName && Array.isArray(sub.beneficiaries)) {
          const beneficiaries = sub.beneficiaries as any[];
          const bIndex = beneficiaries.findIndex(
            (b: any) => b.name.toLowerCase() === appointment.beneficiaryName?.toLowerCase()
          );
          const bEntry = beneficiaries[bIndex];
          if (bIndex !== -1 && bEntry && bEntry.uses < bEntry.maxUses) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: {
                usesThisCycle: sub.usesThisCycle + 1,
                beneficiaries: beneficiaries.map((b, i) =>
                  i === bIndex ? { ...b, uses: b.uses + 1 } : b
                ),
              },
            });
          }
        } else if (!appointment.beneficiaryName) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { usesThisCycle: sub.usesThisCycle + 1 },
          });
        }
      }
    }

    // ── CANCELLED: Devolve uso do plano se já tinha sido DONE ──
    if (status === "CANCELLED" && previousState?.status === "DONE" && appointment.subscriptionId) {
      const sub = await prisma.subscription.findUnique({
        where: { id: appointment.subscriptionId },
      });

      if (sub) {
        if (appointment.beneficiaryName && Array.isArray(sub.beneficiaries)) {
          const beneficiaries = sub.beneficiaries as any[];
          const bIndex = beneficiaries.findIndex(
            (b: any) => b.name.toLowerCase() === appointment.beneficiaryName?.toLowerCase()
          );
          if (bIndex !== -1) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: {
                usesThisCycle: Math.max(0, sub.usesThisCycle - 1),
                beneficiaries: beneficiaries.map((b, i) =>
                  i === bIndex ? { ...b, uses: Math.max(0, b.uses - 1) } : b
                ),
              },
            });
          }
        } else if (!appointment.beneficiaryName) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { usesThisCycle: Math.max(0, sub.usesThisCycle - 1) },
          });
        }
      }
    }

    // ── Audit: mudança de status ──
    if (status && previousState.status !== status) {
      void logAudit({
        barbershopId,
        userId:    payload.id,
        userEmail: payload.email,
        userRole:  payload.role,
        action:    "STATUS_CHANGE",
        entity:    "Appointment",
        entityId:  id,
        diff: {
          before: { status: previousState.status },
          after:  { status, paymentMethod: paymentMethod ?? undefined },
        },
        ip: getClientIp(req),
      });
    }

    // ── Automação de WhatsApp: Confirmação de Status + NPS Link ──
    if ((status === "DONE" || status === "CANCELLED") && appointment.client.phone) {
      const host = req.headers.get("host") || "iadebarbearia.com.br";
      const protocol = host.includes("localhost") ? "http" : "https";
      const appUrl = `${protocol}://${host}`;

      const defaultDoneMsg = `✅ *Atendimento Concluído!*\n\nOlá *${appointment.client.name.split(" ")[0]}*, seu atendimento no *${appointment.barbershop.name}* foi finalizado. Obrigado pela preferência! 🙏\n\n⭐ *O que achou do seu atendimento?* Avalie em 10 segundos e ganhe *+10 pontos* de fidelidade:\n🔗 ${appUrl}/avaliar/${appointment.id}`;
      const defaultCancelledMsg = `⚠️ *Agendamento Cancelado*\n\nOlá *${appointment.client.name.split(" ")[0]}*, seu agendamento para o dia ${format(new Date(appointment.date), "dd/MM")} às ${appointment.startTime} foi cancelado. Se houver dúvidas, entre em contato.`;

      const msg = status === "DONE"
        ? defaultDoneMsg
        : (appointment.barbershop.aiMensagemCancelamento || defaultCancelledMsg);

      sendWhatsAppNotification(barbershopId, appointment.client.phone, msg).catch(console.error);
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
    const { clientName, clientPhone, barberId, serviceId, serviceIds, date, startTime, force, beneficiaryName } = body;

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

    // Encontra ou cria o cliente — busca direta, sem full table scan
    const phoneDigits = clientPhone.replace(/\D/g, "");
    const clientEmail = `${phoneDigits}@cliente.iadebarbearia.com`;
    let client = await prisma.user.findFirst({ where: { phone: phoneDigits, role: "CLIENT" } })
      ?? await prisma.user.findUnique({ where: { email: clientEmail } })
      ?? await prisma.user.findFirst({
          where: {
            role: "CLIENT",
            OR: [
              { email: `${phoneDigits}@cliente.barberfluxo.com` },
              { email: `${phoneDigits}@cliente.barberfluxo` },
              { email: `${phoneDigits}@cliente.barberapp` },
            ],
          },
        });

    if (!client) {
      client = await prisma.user.create({
        data: { name: clientName, email: clientEmail, phone: phoneDigits, password: "123456", role: "CLIENT" },
      });
    }

    // Calcula endTime com base na duração total de todos os serviços
    const [h, m] = startTime.split(":").map(Number);
    const endTotalMinutes = h * 60 + m + totalDuration;
    const endH = Math.floor(endTotalMinutes / 60);
    const endM = endTotalMinutes % 60;
    const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

    // Calcula a data (meio-dia para evitar fuso)
    const appointmentDate = new Date(date + "T12:00:00Z");

    // Verifica se o cliente possui assinatura ativa
    let subscription = await prisma.subscription.findFirst({
      where: { clientId: client.id, status: "ACTIVE", barbershopId },
      include: { plan: { include: { allowedBarbers: true } } },
    });

    // ── Sprint 1: Bloqueia se assinatura vencida ──
    if (subscription && new Date(subscription.nextBillingDate) < new Date()) {
      // Assinatura vencida — não permite uso do plano
      if (beneficiaryName && !force) {
        return NextResponse.json({
          error: "SUBSCRIPTION_OVERDUE",
          message: `A assinatura de ${client.name} está vencida desde ${new Date(subscription.nextBillingDate).toLocaleDateString("pt-BR")}. Regularize o pagamento para usar o plano.`
        }, { status: 403 });
      }
      // Se não escolheu beneficiário, trata como cliente avulso (sem plano)
      subscription = null;
    }

    // ── Sprint 2: Bloqueia se barbeiro não permitido pelo plano ──
    if (subscription && subscription.plan.allowedBarbers.length > 0) {
      const isAllowed = subscription.plan.allowedBarbers.some((b) => b.id === barberId);
      if (!isAllowed) {
        if (beneficiaryName && !force) {
          return NextResponse.json({
            error: "BARBER_NOT_ALLOWED",
            message: `O profissional selecionado não está autorizado para realizar serviços do plano ${subscription.plan.name}.`
          }, { status: 403 });
        }
        // Se não era forçado o uso do plano, trata como cliente avulso
        subscription = null;
      }
    }

    // ── Trava de Frequência Semanal (Regra PM) ──
    if (subscription && beneficiaryName) {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - 7); // Janela de 7 dias
      
      const recentUsage = await prisma.appointment.findFirst({
        where: {
          subscriptionId: subscription.id,
          beneficiaryName: { mode: "insensitive", equals: beneficiaryName },
          status: { notIn: ["CANCELLED"] },
          date: { gte: startOfWeek }
        }
      });

      if (recentUsage && !force) {
        return NextResponse.json({ 
          error: "WEEKLY_LIMIT", 
          message: `Este beneficiário (${beneficiaryName}) já utilizou o plano nos últimos 7 dias.` 
        }, { status: 403 });
      }
    }

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
          subscriptionId: subscription?.id || null,
          beneficiaryName: beneficiaryName || null,
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

    // ── Audit: criação de agendamento ──
    void logAudit({
      barbershopId,
      userId:    payload.id,
      userEmail: payload.email,
      userRole:  payload.role,
      action:    "CREATE",
      entity:    "Appointment",
      entityId:  appointment.id,
      diff: { after: { clientName, barberId, serviceIds: ids, date, startTime, price: totalPrice } },
      ip: getClientIp(req),
    });

    // ── Automação de WhatsApp: Confirmação de Agendamento ──
    const [shopInfo, barberInfo] = await Promise.all([
      prisma.barbershop.findUnique({ where: { id: barbershopId }, select: { name: true, aiMensagemConfirmacaoAgendamento: true } }),
      prisma.barber.findUnique({ where: { id: barberId }, include: { user: { select: { name: true } } } }),
    ]);
    const servicesStr = services.map(s => s.name).join(" + ");
    const defaultConfirmMsg = `📅 *Agendamento Confirmado!*\n\nOlá *${clientName.split(" ")[0]}*, seu horário no *${shopInfo?.name}* está reservado:\n\n🗓️ *${format(appointmentDate, "dd 'de' MMMM", { locale: ptBR })}*\n⏰ Às *${startTime}*\n👤 Barbeiro: *${barberInfo?.user.name}*\n🛠️ Serviços: ${servicesStr}\n\nEsperamos você! 💈`;
    sendWhatsAppNotification(barbershopId, clientPhone, shopInfo?.aiMensagemConfirmacaoAgendamento || defaultConfirmMsg).catch(console.error);

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID ausente" }, { status: 400 });

    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: { subscription: true }
    });

    if (!appt || appt.barbershopId !== payload.barbershopId!) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    // Se o agendamento estava CONCLUÍDO e usava plano, devolve o uso ao excluir
    if (appt.status === "DONE" && appt.subscriptionId && appt.beneficiaryName) {
      const sub = await prisma.subscription.findUnique({
        where: { id: appt.subscriptionId },
      });

      if (sub && Array.isArray(sub.beneficiaries)) {
        const updatedBeneficiaries = (sub.beneficiaries as any[]).map((b: any) =>
          b.name.toLowerCase() === appt.beneficiaryName?.toLowerCase() 
            ? { ...b, uses: Math.max(0, b.uses - 1) } 
            : b
        );
        
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            usesThisCycle: Math.max(0, sub.usesThisCycle - 1),
            beneficiaries: updatedBeneficiaries,
          },
        });
      }
    }

    // Exclui serviços vinculados primeiro (caso não tenha cascade no prisma)
    // Embora tenhamos visto cascade no schema, vamos ser defensivos.
    await prisma.appointmentService.deleteMany({
      where: { appointmentId: id }
    });

    await prisma.appointment.delete({
      where: { id },
    });

    // ── Audit: exclusão de agendamento ──
    void logAudit({
      barbershopId: payload.barbershopId!,
      userId:    payload.id,
      userEmail: payload.email,
      userRole:  payload.role,
      action:    "DELETE",
      entity:    "Appointment",
      entityId:  id,
      diff: {
        before: {
          clientId:  appt.clientId,
          date:      appt.date,
          startTime: appt.startTime,
          status:    appt.status,
        },
      },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error("Erro ao excluir agendamento:", e);
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
