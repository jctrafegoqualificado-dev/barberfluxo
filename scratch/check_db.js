const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const instances = await prisma.whatsAppInstance.findMany();
  console.log("Instances in DB:", instances);
}
main().catch(console.error).finally(() => prisma.$disconnect());
