import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/evolution/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DEFAULT_MESSAGE = `Olá {{nome}}! 😊

Lembramos que você tem um horário de *{{servico}}* marcado para *{{data}}* às *{{hora}}* com *{{profissional}}* no(a) *{{empresa}}*.

Podemos confirmar sua presença? Responda com *SIM* para confirmar ou *NÃO* para cancelar.`;

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * Reminder Cron Job — Multi-Tenant
 * 
 * Chamado a cada 15 minutos (Vercel Cron ou chamada externa).
 * Varre TODOS os estabelecimentos que ativaram lembretes e envia
 * WhatsApp personalizado via Evolution API para clientes com
 * agendamentos próximos.
 * 
 * Fluxo:
 * 1. Busca todos os tenants com reminderEnabled = true e WhatsApp conectado
 * 2. Para cada tenant, busca agendamentos PENDING/CONFIRMED onde:
 *    - reminderSent = false
 *    - data/hora está dentro da janela de reminder
 * 3. Envia mensagem personalizada via Evolution API
 * 4. Marca reminderSent = true para evitar duplicatas
 */
export async function GET(req: NextRequest) {
  try {
    // Segurança: só permite chamadas com o secret correto
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    const providedSecret = authHeader?.replace("Bearer ", "") || querySecret;

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    console.log(`⏰ [Reminder Job] Starting at ${now.toISOString()}`);

    // 1. Busca todos os estabelecimentos com lembretes ativados E WhatsApp conectado
    const shops = await prisma.barbershop.findMany({
      where: {
        reminderEnabled: true,
        active: true,
        whatsappInstance: {
          status: "CONNECTED",
        },
      },
      select: {
        id: true,
        name: true,
        reminderMinutes: true,
        reminderMessage: true,
        whatsappInstance: {
          select: {
            evolutionInstanceName: true,
            evolutionToken: true,
          },
        },
      },
    });

    console.log(`📋 [Reminder Job] Found ${shops.length} shops with reminders enabled`);

    let totalSent = 0;
    let totalErrors = 0;

    for (const shop of shops) {
      if (!shop.whatsappInstance) continue;

      const reminderMinutes = shop.reminderMinutes || 60;

      // 2. Calcula a janela de envio (agora + reminderMinutes +/- 7.5 min margem do cron)
      const windowStart = new Date(now.getTime() + (reminderMinutes - 7.5) * 60 * 1000);
      const windowEnd = new Date(now.getTime() + (reminderMinutes + 7.5) * 60 * 1000);

      // Busca agendamentos elegíveis
      const appointments = await prisma.appointment.findMany({
        where: {
          barbershopId: shop.id,
          reminderSent: false,
          status: { in: ["PENDING", "CONFIRMED"] },
          date: {
            gte: new Date(windowStart.toISOString().slice(0, 10) + "T00:00:00"),
            lte: new Date(windowEnd.toISOString().slice(0, 10) + "T23:59:59"),
          },
        },
        include: {
          client: { select: { name: true, phone: true } },
          service: { select: { name: true } },
          barber: { include: { user: { select: { name: true } } } },
        },
      });

      // Filtra pela janela exata (usando startTime do agendamento)
      const eligible = appointments.filter((appt) => {
        const [h, m] = appt.startTime.split(":").map(Number);
        const apptDateTime = new Date(appt.date);
        apptDateTime.setHours(h, m, 0, 0);
        return apptDateTime >= windowStart && apptDateTime <= windowEnd;
      });

      if (eligible.length === 0) continue;

      console.log(`📱 [Reminder Job] ${shop.name}: ${eligible.length} reminders to send`);

      const messageTemplate = shop.reminderMessage || DEFAULT_MESSAGE;

      for (const appt of eligible) {
        const clientPhone = appt.client?.phone;
        if (!clientPhone) {
          console.warn(`⚠️ [Reminder Job] Skipping appointment ${appt.id}: no phone number`);
          continue;
        }

        // 3. Monta a mensagem personalizada com as variáveis substituídas
        const appointmentDate = new Date(appt.date);
        const personalizedMessage = messageTemplate
          .replace(/\{\{nome\}\}/g, appt.client?.name?.split(" ")[0] || "Cliente")
          .replace(/\{\{servico\}\}/g, appt.service?.name || "Serviço")
          .replace(/\{\{data\}\}/g, format(appointmentDate, "dd/MM/yyyy", { locale: ptBR }))
          .replace(/\{\{hora\}\}/g, appt.startTime)
          .replace(/\{\{profissional\}\}/g, appt.barber?.user?.name || "Profissional")
          .replace(/\{\{empresa\}\}/g, shop.name);

        // 4. Envia via Evolution API
        const result = await sendMessage(
          shop.whatsappInstance.evolutionInstanceName,
          clientPhone,
          personalizedMessage,
          1200,
          shop.whatsappInstance.evolutionToken
        );

        if ("error" in result) {
          console.error(`❌ [Reminder Job] Failed for ${appt.id}: ${result.error}`);
          totalErrors++;
        } else {
          console.log(`✅ [Reminder Job] Sent reminder for appointment ${appt.id}`);
          totalSent++;
        }

        // 5. Marca como enviado (mesmo em caso de erro, para evitar spam)
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { reminderSent: true },
        });

        // Delay entre mensagens para evitar rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    const summary = {
      timestamp: now.toISOString(),
      shopsProcessed: shops.length,
      remindersSent: totalSent,
      errors: totalErrors,
    };

    console.log(`✅ [Reminder Job] Completed:`, summary);
    return NextResponse.json(summary);
  } catch (e: unknown) {
    console.error("❌ [Reminder Job] Fatal error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
