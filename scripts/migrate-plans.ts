import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migrando Planos e Assinaturas (Neon -> Supabase)');

  const dataPath = 'C:\\Users\\NeoMissio\\Documents\\BarberJoao\\barberapp\\extracted_data.json';
  if (!fs.existsSync(dataPath)) {
    console.error('Arquivo extraído não encontrado!');
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const OLD_SHOP_ID = 'cmo796fas0002la04zfmxl3al';

  // Buscar a barbearia alvo no Supabase (a que criamos)
  const shop = await prisma.barbershop.findUnique({ where: { id: OLD_SHOP_ID } });
  if (!shop) {
    console.error('Barbearia não encontrada no Supabase! Rode o migrate.ts primeiro.');
    return;
  }
  const targetShopId = shop.id;
  console.log(`Barbearia alvo: ${shop.name} (${targetShopId})`);

  // Montar mapa de serviceId antigo -> novo (eles deveriam ser iguais, mas por segurança)
  const existingServices = await prisma.service.findMany({ where: { barbershopId: targetShopId } });
  const serviceIdMap = new Map(existingServices.map(s => [s.id, s.id]));

  // Montar mapa de clientId antigo -> novo
  const existingUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const emailToId = new Map(existingUsers.map(u => [u.email, u.id]));

  // ─── 1. PLANOS ───────────────────────────────────────────────────────────────
  console.log('\n📋 Migrando Planos...');
  const plans: any[] = rawData.plans || [];
  const filteredPlans = plans.filter((p: any) => p.barbershopId === OLD_SHOP_ID);
  console.log(`  Planos encontrados para esta barbearia: ${filteredPlans.length}`);

  const planIdMap = new Map<string, string>();
  let plansCreated = 0;

  for (const plan of filteredPlans) {
    try {
      const existing = await prisma.plan.findUnique({ where: { id: plan.id } });
      if (!existing) {
        const created = await prisma.plan.create({
          data: {
            id: plan.id,
            name: plan.name,
            description: plan.description || null,
            price: plan.price,
            billingCycle: plan.billingCycle || 'MONTHLY',
            maxUses: plan.maxUses || null,
            active: plan.active ?? true,
            barbershopId: targetShopId,
            // Criar os serviços vinculados ao plano (PlanService)
            planServices: {
              create: (plan.planServices || [])
                .filter((ps: any) => serviceIdMap.has(ps.serviceId))
                .map((ps: any) => ({
                  serviceId: serviceIdMap.get(ps.serviceId)!,
                  quantity: ps.quantity || null,
                }))
            }
          }
        });
        planIdMap.set(plan.id, created.id);
        console.log(`  ✅ Plano criado: "${plan.name}" (${plan.planServices?.length || 0} serviços vinculados)`);
        plansCreated++;
      } else {
        planIdMap.set(plan.id, existing.id);
        console.log(`  ↩️  Plano já existe: "${plan.name}"`);
      }
    } catch (err: any) {
      console.warn(`  ⚠️  Erro ao criar plano "${plan.name}":`, err.message);
    }
  }
  console.log(`> ${plansCreated} planos criados.`);

  // ─── 2. ASSINATURAS ──────────────────────────────────────────────────────────
  console.log('\n📌 Migrando Assinaturas...');
  const subscriptions: any[] = rawData.subscriptions || [];
  const filteredSubs = subscriptions.filter((s: any) => s.barbershopId === OLD_SHOP_ID);
  console.log(`  Assinaturas encontradas para esta barbearia: ${filteredSubs.length}`);

  let subsCreated = 0;
  let subsSkipped = 0;

  for (const sub of filteredSubs) {
    // Precisamos do clientId no banco novo
    const oldClient = rawData.users.find((u: any) => u.id === sub.clientId);
    if (!oldClient) {
      console.warn(`  ⚠️  Cliente não encontrado para assinatura ${sub.id}`);
      subsSkipped++;
      continue;
    }

    const newClientId = emailToId.get(oldClient.email);
    if (!newClientId) {
      console.warn(`  ⚠️  Cliente ${oldClient.email} não está no Supabase. Pulando...`);
      subsSkipped++;
      continue;
    }

    const newPlanId = planIdMap.get(sub.planId);
    if (!newPlanId) {
      console.warn(`  ⚠️  Plano ${sub.planId} não encontrado no Supabase. Pulando assinatura ${sub.id}`);
      subsSkipped++;
      continue;
    }

    try {
      const existing = await prisma.subscription.findUnique({ where: { id: sub.id } });
      if (!existing) {
        await prisma.subscription.create({
          data: {
            id: sub.id,
            status: sub.status || 'ACTIVE',
            startDate: new Date(sub.startDate),
            nextBillingDate: new Date(sub.nextBillingDate),
            usesThisCycle: sub.usesThisCycle || 0,
            clientId: newClientId,
            barbershopId: targetShopId,
            planId: newPlanId,
          }
        });
        subsCreated++;
      } else {
        subsSkipped++;
      }
    } catch (err: any) {
      console.warn(`  ⚠️  Erro na assinatura ${sub.id}:`, err.message);
      subsSkipped++;
    }
  }

  console.log(`> ${subsCreated} assinaturas criadas. ${subsSkipped} ignoradas.`);
  console.log('\n✅ Migração de Planos e Assinaturas concluída!');
}

main()
  .catch(e => {
    console.error('Erro na migração:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
