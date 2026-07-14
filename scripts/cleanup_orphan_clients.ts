import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Varre clientes "fantasma": usuários role=CLIENT que foram criados mas nunca
 * chegaram a ter um agendamento/assinatura (bug antigo em que o cliente era
 * criado ANTES da transação do agendamento e ficava órfão se o fluxo abortava).
 *
 * Um usuário só é considerado órfão — e portanto seguro de excluir — se NÃO tiver
 * NENHUM vínculo em NENHUMA barbearia:
 *   - sem agendamentos, assinaturas, vendas de produto, avaliações, pontos de
 *     fidelidade, contatos de WhatsApp nem registros de retenção;
 *   - e não for barbeiro (barberProfile) nem dono (ownedShop).
 * Isso garante que a exclusão não remove dado útil nem esbarra em FK.
 *
 * User é global (não pertence a uma barbearia), então a varredura é global.
 *
 * Uso:
 *   Dry-run (só lista, padrão):  npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/cleanup_orphan_clients.ts
 *   Excluir de fato:             npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/cleanup_orphan_clients.ts --apply
 */
async function main() {
  const apply = process.argv.includes("--apply");

  const orphans = await prisma.user.findMany({
    where: {
      role: "CLIENT",
      isPlatformAdmin: false,
      barberProfile: { is: null },
      ownedShop: { is: null },
      appointments: { none: {} },
      subscriptions: { none: {} },
      productSales: { none: {} },
      reviews: { none: {} },
      loyaltyPoints: { none: {} },
      whatsappContacts: { none: {} },
      clientRetentions: { none: {} },
    },
    select: { id: true, name: true, phone: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n🔎 Encontrados ${orphans.length} clientes órfãos (role=CLIENT, sem nenhum vínculo).\n`);

  for (const u of orphans) {
    console.log(`  • ${u.name.padEnd(30)} tel=${u.phone ?? "—"}  criado=${u.createdAt.toISOString().slice(0, 10)}  id=${u.id}`);
  }

  if (orphans.length === 0) {
    console.log("\n✅ Nada a fazer.\n");
    return;
  }

  if (!apply) {
    console.log(`\nℹ️  DRY-RUN: nada foi alterado. Rode novamente com --apply para excluir os ${orphans.length} registros acima.\n`);
    return;
  }

  const result = await prisma.user.deleteMany({
    where: { id: { in: orphans.map((u) => u.id) } },
  });

  console.log(`\n🗑️  Excluídos ${result.count} clientes órfãos.\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
