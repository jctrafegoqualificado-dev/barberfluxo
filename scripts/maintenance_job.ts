import { PrismaClient } from "@prisma/client";
import * as evolution from "../src/lib/evolution/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const prisma = new PrismaClient();

async function runMaintenance() {
  console.log(`🕒 [Job] Iniciando manutenção: ${new Date().toISOString()}`);

  try {
    const now = new Date();

    // ── 1. ASSINATURAS VENCIDAS ──
    console.log("🔍 [Job] Buscando assinaturas vencidas...");
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
      console.log(`⚠️ [Job] Assinatura ${sub.id} do cliente ${sub.client.name} VENCIDA.`);
      
      // Atualiza status para OVERDUE
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "OVERDUE" }
      });

      // Busca instância do WhatsApp
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { barbershopId: sub.barbershopId }
      });

      if (instance && instance.status === "CONNECTED" && sub.client.phone) {
        const message = `Olá *${sub.client.name.split(" ")[0]}*! 💈\n\nSua assinatura no *${sub.barbershop.name}* venceu em ${format(new Date(sub.nextBillingDate), "dd/MM")}.\n\nPara continuar utilizando os benefícios do seu plano, por favor, regularize o pagamento na sua próxima visita ou via PIX. 💸\n\nQualquer dúvida, estamos à disposição!`;
        
        // Limpa o número para o padrão WhatsApp (somente dígitos + @s.whatsapp.net)
        const cleanNumber = sub.client.phone.replace(/\D/g, "");
        const jid = `${cleanNumber}@s.whatsapp.net`;

        await evolution.sendMessage(instance.evolutionInstanceName, jid, message);
        console.log(`✉️ [Job] Notificação enviada para ${sub.client.name}`);
      }
    }

    // ── 2. LEMBRETES DE AGENDAMENTO (PARA AMANHÃ) ──
    console.log("🔍 [Job] Buscando agendamentos para amanhã...");
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const tomorrowsAppointments = await prisma.appointment.findMany({
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

    for (const appt of tomorrowsAppointments) {
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { barbershopId: appt.barbershopId }
      });

      if (instance && instance.status === "CONNECTED" && appt.client.phone) {
        const servicesStr = appt.services.map(s => s.service.name).join(" + ");
        const message = `Olá *${appt.client.name.split(" ")[0]}*! ✂️\n\nLembrete do seu agendamento no *${appt.barbershop.name}*:\n\n📅 *Amanhã, ${format(new Date(appt.date), "dd/MM", { locale: ptBR })}*\n⏰ Às *${appt.startTime}*\n👤 Barbeiro: *${appt.barber.user.name}*\n🛠️ Serviços: ${servicesStr}\n\nEsperamos você! Se precisar desmarcar, avise com antecedência. 🙏`;
        
        const cleanNumber = appt.client.phone.replace(/\D/g, "");
        const jid = `${cleanNumber}@s.whatsapp.net`;

        await evolution.sendMessage(instance.evolutionInstanceName, jid, message);
        
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { reminderSent: true }
        });
        console.log(`✉️ [Job] Lembrete enviado para ${appt.client.phone}`);
      }
    }

    console.log("✅ [Job] Manutenção concluída com sucesso.");
  } catch (error) {
    console.error("❌ [Job] Erro durante a manutenção:", error);
  } finally {
    await prisma.$disconnect();
  }
}

runMaintenance();
