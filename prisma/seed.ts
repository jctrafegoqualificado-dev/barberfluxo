import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("123456", 12);

  const owner = await prisma.user.upsert({
    where: { email: "dono@barberapp.com" },
    update: {},
    create: { name: "João Dono", email: "dono@barberapp.com", password: hash, role: "OWNER", phone: "(41) 99999-0001" },
  });

  const shop = await prisma.barbershop.upsert({
    where: { slug: "barbearia-demo" },
    update: {},
    create: {
      name: "Barbearia Demo",
      slug: "barbearia-demo",
      ownerId: owner.id,
      description: "A melhor barbearia da cidade!",
      phone: "(41) 99999-0000",
      address: "Rua das Tesouras, 123",
      city: "Curitiba",
      state: "PR",
      openingHours: {
        create: [1, 2, 3, 4, 5, 6].map((day) => ({
          dayOfWeek: day,
          openTime: "09:00",
          closeTime: "20:00",
          isOpen: true,
        })),
      },
    },
  });

  const barberUser = await prisma.user.upsert({
    where: { email: "barbeiro@barberapp.com" },
    update: {},
    create: { name: "Pedro Barbeiro", email: "barbeiro@barberapp.com", password: hash, role: "BARBER", phone: "(41) 99999-0002" },
  });

  await prisma.barber.upsert({
    where: { userId: barberUser.id },
    update: {},
    create: { userId: barberUser.id, barbershopId: shop.id, commission: 50, nickname: "Pedrão" },
  });

  const corte = await prisma.service.upsert({
    where: { id: "service-corte" },
    update: {},
    create: { id: "service-corte", name: "Corte de Cabelo", price: 45, duration: 30, barbershopId: shop.id },
  });

  await prisma.service.upsert({
    where: { id: "service-barba" },
    update: {},
    create: { id: "service-barba", name: "Barba", price: 35, duration: 30, barbershopId: shop.id },
  });

  await prisma.service.upsert({
    where: { id: "service-combo" },
    update: {},
    create: { id: "service-combo", name: "Corte + Barba", price: 70, duration: 60, barbershopId: shop.id },
  });

  const plan = await prisma.plan.upsert({
    where: { id: "plan-mensal" },
    update: {},
    create: { id: "plan-mensal", name: "Plano Mensal", price: 120, billingCycle: "MONTHLY", maxUses: 4, barbershopId: shop.id },
  });

  await prisma.planService.upsert({
    where: { id: "ps-1" },
    update: {},
    create: { id: "ps-1", planId: plan.id, serviceId: corte.id },
  });

  console.log("✅ Seed concluído!");
  console.log("📧 Dono: dono@barberapp.com / 123456");
  console.log("📧 Barbeiro: barbeiro@barberapp.com / 123456");
  console.log("🌐 Agendamento: /agendar/barbearia-demo");
}

main().catch(console.error).finally(() => prisma.$disconnect());
