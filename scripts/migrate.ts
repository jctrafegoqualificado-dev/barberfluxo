import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Iniciando Migração de Dados (BarberApp -> Supabase)');
  
  const dataPath = 'C:\\\\Users\\\\NeoMissio\\\\Documents\\\\BarberJoao\\\\barberapp\\\\extracted_data.json';
  if (!fs.existsSync(dataPath)) {
    console.error('Arquivo extraído não encontrado em:', dataPath);
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const OLD_SHOP_ID = 'cmo796fas0002la04zfmxl3al';
  const OWNER_EMAIL = 'lordofbarbaoficial@gmail.com';

  console.log(`Lidos: ${rawData.users.length} usuários, ${rawData.appointments.length} agendamentos, ${rawData.barbers.length} barbeiros, ${rawData.services.length} serviços.`);

  const userIdMap = new Map<string, string>();
  const barberIdMap = new Map<string, string>();
  const serviceIdMap = new Map<string, string>();

  // 1. Procurar ou criar o dono no Supabase
  let ownerUser = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  
  if (!ownerUser) {
    const oldOwner = rawData.users.find((u: any) => u.email === OWNER_EMAIL);
    if (!oldOwner) throw new Error('Dono não encontrado no arquivo JSON.');
    
    console.log('Criando usuário DONO...');
    ownerUser = await prisma.user.create({
      data: {
        id: oldOwner.id,
        name: oldOwner.name,
        email: oldOwner.email,
        password: oldOwner.password,
        role: 'OWNER',
        phone: oldOwner.phone,
      }
    });
    userIdMap.set(oldOwner.id, ownerUser.id);
  } else {
    console.log('Dono já existe no Supabase. ID:', ownerUser.id);
    const oldOwner = rawData.users.find((u: any) => u.email === OWNER_EMAIL);
    if (oldOwner) userIdMap.set(oldOwner.id, ownerUser.id);
  }

  // 2. Procurar ou criar a Barbearia
  let shop = await prisma.barbershop.findUnique({ where: { ownerId: ownerUser.id } });
  if (!shop) {
    console.log('Criando Barbearia...');
    shop = await prisma.barbershop.create({
      data: {
        id: OLD_SHOP_ID,
        name: 'Lord of Barba',
        slug: 'lord-of-barba',
        ownerId: ownerUser.id,
      }
    });
  }
  const targetShopId = shop.id;

  // 3. Importar Clientes (Somente CLIENT)
  console.log('Migrando Clientes...');
  let clientsCreated = 0;
  for (const u of rawData.users) {
    if (u.role !== 'CLIENT') continue;
    
    try {
      const createdClient = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          phone: u.phone,
        },
        create: {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          password: u.password,
          role: 'CLIENT'
        }
      });
      userIdMap.set(u.id, createdClient.id);
      clientsCreated++;
    } catch (err: any) {
      console.warn(`Aviso ao inserir cliente ${u.email}:`, err.message);
    }
  }
  console.log(`> ${clientsCreated} clientes sincronizados.`);

  // 4. Importar Barbeiros
  console.log('Migrando Barbeiros...');
  for (const b of rawData.barbers) {
    const bUser = rawData.users.find((u: any) => u.id === b.userId);
    if (!bUser) continue;
    
    const createdUser = await prisma.user.upsert({
      where: { email: bUser.email },
      update: { role: 'BARBER' },
      create: {
        id: bUser.id,
        name: bUser.name,
        email: bUser.email,
        password: bUser.password,
        role: 'BARBER',
        phone: bUser.phone,
      }
    });
    userIdMap.set(bUser.id, createdUser.id);

    const createdBarber = await prisma.barber.upsert({
      where: { userId: createdUser.id },
      update: {},
      create: {
        id: b.id,
        nickname: b.nickname || bUser.name,
        active: b.active,
        commission: b.commission || 50,
        userId: createdUser.id,
        barbershopId: targetShopId,
      }
    });
    barberIdMap.set(b.id, createdBarber.id);
  }

  // 5. Importar Serviços
  console.log('Migrando Serviços...');
  for (const s of rawData.services) {
    if (s.barbershopId !== OLD_SHOP_ID) continue; 

    const createdService = await prisma.service.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        name: s.name,
        price: s.price,
        duration: s.duration,
        materialCost: 0,
        barbershopId: targetShopId
      }
    });
    serviceIdMap.set(s.id, createdService.id);
  }

  // 6. Importar Agendamentos
  console.log('Migrando Agendamentos...');
  let apptsCreated = 0;
  for (const a of rawData.appointments) {
    if (a.barbershopId !== OLD_SHOP_ID) continue;

    const realClientId = userIdMap.get(a.clientId);
    const realBarberId = barberIdMap.get(a.barberId);
    const realServiceId = a.serviceId ? serviceIdMap.get(a.serviceId) : null;

    if (!realClientId || !realBarberId || !realServiceId) {
      console.warn(`Pulando agendamento ${a.id} (Referências faltando na migração atual)`);
      continue;
    }

    try {
      const existing = await prisma.appointment.findUnique({ where: { id: a.id } });
      if (!existing) {
        // Encontrar o serviço para pegar o preço e duração
        const sourceService = rawData.services.find((s: any) => s.id === a.serviceId);

        await prisma.appointment.create({
          data: {
            id: a.id,
            date: new Date(a.date),
            startTime: a.startTime,
            endTime: a.endTime,
            status: a.status,
            price: a.price,
            clientId: realClientId,
            barbershopId: targetShopId,
            barberId: realBarberId,
            createdAt: a.createdAt ? new Date(a.createdAt) : undefined,
            services: {
              create: [
                {
                  serviceId: realServiceId,
                  price: sourceService ? sourceService.price : a.price,
                  duration: sourceService ? sourceService.duration : 30
                }
              ]
            }
          }
        });
        apptsCreated++;
      }
    } catch (err: any) {
      console.warn(`Erro no agendamento ${a.id}:`, err.message);
    }
  }
  
  console.log(`> ${apptsCreated} agendamentos inseridos com sucesso.`);
  console.log('✅ Migração concluída com perfeição!');
}

main()
  .catch(e => {
    console.error('Erro na migração:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
