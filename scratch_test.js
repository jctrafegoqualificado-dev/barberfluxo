const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const apps = await prisma.appointment.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  console.log(apps);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
