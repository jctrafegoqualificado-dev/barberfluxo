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
    remindersSent: 0,
    errors: [] as string[]
  };

  try {
    const now = new Date();

    // ── 1. ASSINATURAS VENCIDAS ──
    const overdueSubs = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        nextBillingDate: { lte: now },
      },
      include: {
        client: true,
        barbershop: true,
      }
    });

    for (const sub of overdueSubs) {
      try {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "OVERDUE" }
        });

        const instance = await prisma.whatsAppInstance.findFirst({
          where: { barbershopId: sub.barbershopId, status: "CONNECTED" }
        });

        if (instance && sub.client.phone) {
          const message = `Olá *${sub.client.name.split(" ")[0]}*! 💈\n\nSua assinatura no *${sub.barbershop.name}* venceu em ${format(new Date(sub.nextBillingDate), "dd/MM")}.\n\nPara continuar utilizando os benefícios do seu plano, por favor, regularize o pagamento na sua próxima visita. 💸`;
          
          const cleanNumber = sub.client.phone.replace(/\D/g, "");
          const jid = cleanNumber.length > 11 ? `${cleanNumber}@s.whatsapp.net` : `55${cleanNumber}@s.whatsapp.net`;

          await evolution.sendMessage(instance.evolutionInstanceName, jid, message);
          results.overdueNotifications++;
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
