import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "dono@barberapp.com" } });
  if (user && user.role === "OWNER") {
    const shop = await prisma.barbershop.findFirst({ where: { ownerId: user.id } });
    if (shop) {
      await prisma.barbershop.update({
        where: { id: shop.id },
        data: { saasPlan: "BASIC" },
      });
      console.log("Plano da barbearia atualizado para BASIC.");
    }
  }
}

main().finally(() => prisma.$disconnect());
