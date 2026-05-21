import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const appointments = await prisma.appointment.findMany({
    where: {
      subscriptionId: null,
      status: "DONE"
    },
    include: {
      client: true
    }
  });

  console.log(`Encontrados ${appointments.length} agendamentos DONE sem subscriptionId.`);

  let updatedCount = 0;
  for (const appt of appointments) {
    const sub = await prisma.subscription.findFirst({
      where: {
        clientId: appt.clientId,
        status: "ACTIVE",
        barbershopId: appt.barbershopId
      }
    });

    if (sub) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { subscriptionId: sub.id }
      });
      updatedCount++;
    }
  }

  console.log(`Atualizados ${updatedCount} agendamentos vinculando a assinatura.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
