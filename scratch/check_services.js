const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const barbershops = await prisma.barbershop.findMany({ include: { services: true } });
  console.log("Barbershops:", JSON.stringify(barbershops, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
