import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const emailTarget = 'breno.albuquerque@gmail.com';
  
  const user = await prisma.user.findUnique({
    where: { email: emailTarget }
  });
  
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'PLATFORM_ADMIN' }
    });
    console.log(`Sucesso! O usuário ${emailTarget} agora é PLATFORM_ADMIN.`);
  } else {
    console.log(`Erro: Usuário com e-mail ${emailTarget} não encontrado no banco de dados.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
