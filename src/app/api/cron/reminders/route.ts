import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/zapi";

export async function GET() {
  try {
    const now = new Date();

    // Busca todas as barbearias com seus reminderMinutes
    const shops = await prisma.barbershop.findMany({
      select: { id: true, name: true, reminderMinutes: true },
    });

    let sent = 0;

    for (const shop of shops) {
      const windowMinutes = shop.reminderMinutes;

      // Janela: agendamentos que começam entre agora e agora + reminderMinutes + 15min (margem do cron)
      const windowStart = new Date(now.getTime() + windowMinutes * 60 * 1000 - 7.5 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000 + 7.5 * 60 * 1000);

      // Busca agendamentos confirmados que ainda não receberam lembrete
      const appointments = await prisma.appointment.findMany({
        where: {
          barbershopId: shop.id,
          status: { in: ["CONFIRMED", "PENDING"] },
          reminderSent: false,
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

      for (const appt of appointments) {
        // Monta datetime completo do agendamento para verificar a janela exata
        const [h, m] = appt.startTime.split(":").map(Number);
        const apptDate = new Date(appt.date);
        apptDate.setHours(h, m, 0, 0);

        if (apptDate < windowStart || apptDate > windowEnd) continue;

        const clientPhone = appt.client.phone;
        if (!clientPhone) continue;

        const [ano, mes, dia] = appt.date.toISOString().slice(0, 10).split("-");
        const dataFormatada = `${dia}/${mes}/${ano}`;

        const msg = [
          `Lembrete de Agendamento - ${shop.name}`,
          ``,
          `Ola, ${appt.client.name.split(" ")[0]}! Seu horario esta chegando.`,
          ``,
          `Servico: ${appt.service.name}`,
          `Barbeiro: ${appt.barber.user.name}`,
          `Data: ${dataFormatada}`,
          `Horario: ${appt.startTime}`,
          ``,
          `Te esperamos la!`,
        ].join("\n");

        await sendWhatsApp(clientPhone, msg);

        await prisma.appointment.update({
          where: { id: appt.id },
          data: { reminderSent: true },
        });

        sent++;
      }
    }

    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    console.error("[CRON] Erro ao enviar lembretes:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
