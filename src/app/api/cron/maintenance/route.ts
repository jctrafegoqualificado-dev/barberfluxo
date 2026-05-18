import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as evolution from "@/lib/evolution/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function GET(req: Request) {
  // 1. Verificação de Segurança
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  console.log(`🕒 [Cron Job] Iniciando manutenção automática: ${new Date().toISOString()}`);

  const results = {
    overdueNotifications: 0,
    pendingPaymentsGenerated: 0,
    remindersSent: 0,
    errors: [] as string[]
  };

  try {
    const now = new Date();

    // ── 1. ASSINATURAS VENCIDAS E GERAÇÃO DE COBRANÇAS ──
    const overdueSubs = await prisma.subscription.findMany({
      where: {
        status: { in: ["ACTIVE", "OVERDUE"] },
        nextBillingDate: { lte: now },
      },
      include: {
        client: true,
        barbershop: true,
        plan: true,
      }
    });

    for (const sub of overdueSubs) {
      try {
        // Atualiza status para OVERDUE se ainda estiver ACTIVE
        if (sub.status === "ACTIVE") {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: "OVERDUE" }
          });
        }

        // --- GERAÇÃO DE COBRANÇA PENDENTE ---
        const { differenceInMonths, startOfDay } = require('date-fns');
        const billingDate = startOfDay(new Date(sub.nextBillingDate));
        const today = startOfDay(new Date());
        
        if (today >= billingDate) {
          const monthsOwed = differenceInMonths(today, billingDate) + 1;
          const pendingCount = await prisma.payment.count({
            where: { subscriptionId: sub.id, status: "PENDING" }
          });

          if (pendingCount < monthsOwed) {
            const missing = monthsOwed - pendingCount;
            for (let i = 0; i < missing; i++) {
              await prisma.payment.create({
                data: {
                  amount: sub.plan.price,
                  method: "PIX", // Default method for pending
                  status: "PENDING",
                  subscriptionId: sub.id,
                  barbershopId: sub.barbershopId
                }
              });
              results.pendingPaymentsGenerated = (results.pendingPaymentsGenerated || 0) + 1;
            }
          }
        }

        // --- NOTIFICAÇÃO VIA WHATSAPP ---
        // Apenas envia a notificação se for o dia exato do vencimento (para não enviar todo dia)
        // Opcionalmente, pode ser configurado um lembrete periódico. Aqui vamos enviar se a diferença for pequena.
        const diffDays = Math.floor((today.getTime() - billingDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0 || diffDays === 1) { // Só avisa no dia ou no dia seguinte
          const instance = await prisma.whatsAppInstance.findFirst({
            where: { barbershopId: sub.barbershopId, status: "CONNECTED" }
          });

          if (instance && sub.client.phone) {
            const message = `Olá *${sub.client.name.split(" ")[0]}*! 💈\n\nSua fatura da assinatura no *${sub.barbershop.name}* fechou em ${format(new Date(sub.nextBillingDate), "dd/MM")}.\n\nValor: *R$ ${sub.plan.price.toFixed(2).replace('.', ',')}*\n\nPara continuar utilizando os benefícios do seu plano, por favor, regularize o pagamento na sua próxima visita ou solicite o PIX. 💸`;
            
            const cleanNumber = sub.client.phone.replace(/\D/g, "");
            const jid = cleanNumber.length > 11 ? `${cleanNumber}@s.whatsapp.net` : `55${cleanNumber}@s.whatsapp.net`;

            await evolution.sendMessage(instance.evolutionInstanceName, jid, message);
            results.overdueNotifications++;
          }
        }
      } catch (err) {
        results.errors.push(`Erro na sub ${sub.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── 2. LEMBRETES DE AGENDAMENTO (AMANHÃ) ──
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: {
        date: { gte: tomorrowStart, lte: tomorrowEnd },
        status: { in: ["CONFIRMED", "PENDING"] },
        reminderSent: false,
      },
      include: {
        client: true,
        barbershop: true,
        barber: { include: { user: true } },
        services: { include: { service: true } }
      }
    });

    for (const appt of appointments) {
      try {
        const instance = await prisma.whatsAppInstance.findFirst({
          where: { barbershopId: appt.barbershopId, status: "CONNECTED" }
        });

        if (instance && appt.client.phone) {
          const servicesStr = appt.services.length > 0 
            ? appt.services.map(s => s.service.name).join(" + ")
            : "Serviço";

          const message = `Olá *${appt.client.name.split(" ")[0]}*! ✂️\n\nLembrete do seu agendamento no *${appt.barbershop.name}*:\n\n📅 *Amanhã, ${format(new Date(appt.date), "dd/MM", { locale: ptBR })}*\n⏰ Às *${appt.startTime}*\n👤 Barbeiro: *${appt.barber.user.name}*\n🛠️ Serviço: ${servicesStr}\n\nEsperamos você! 🙏`;
          
          const cleanNumber = appt.client.phone.replace(/\D/g, "");
          const jid = cleanNumber.length > 11 ? `${cleanNumber}@s.whatsapp.net` : `55${cleanNumber}@s.whatsapp.net`;

          await evolution.sendMessage(instance.evolutionInstanceName, jid, message);
          
          await prisma.appointment.update({
            where: { id: appt.id },
            data: { reminderSent: true }
          });
          results.remindersSent++;
        }
      } catch (err) {
        results.errors.push(`Erro no appt ${appt.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
