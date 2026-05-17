const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBranding() {
  const barbershops = await prisma.barbershop.findMany({
    select: { id: true, name: true, primaryColor: true, secondaryColor: true }
  });
  console.log('📊 Estado Atual do Branding no Banco:');
  console.log(JSON.stringify(barbershops, null, 2));
}

checkBranding().finally(() => prisma.$disconnect());
