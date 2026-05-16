const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.whatsAppSession.findMany();
  console.log("Sessions:", sessions);
}

main().catch(console.error).finally(() => prisma.$disconnect());
