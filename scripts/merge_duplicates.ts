/**
 * Sprint 1 — Script de Merge de Clientes Duplicados
 * 
 * Identifica clientes (role=CLIENT) com o mesmo telefone (sanitizado),
 * unifica agendamentos e assinaturas no registro mais antigo, e remove duplicados.
 * 
 * Executar com: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/merge_duplicates.ts
 * Ou via: npx tsx scripts/merge_duplicates.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Buscando clientes duplicados por telefone...\n");

  const clients = await prisma.user.findMany({
    where: { role: "CLIENT", phone: { not: null } },
    orderBy: { createdAt: "asc" },
  });

  // Agrupa por telefone sanitizado
  const phoneGroups = new Map<string, typeof clients>();
  for (const c of clients) {
    const digits = (c.phone || "").replace(/\D/g, "");
    if (digits.length < 10) continue;
    if (!phoneGroups.has(digits)) phoneGroups.set(digits, []);
    phoneGroups.get(digits)!.push(c);
  }

  // Filtra grupos com duplicados
  const duplicates = [...phoneGroups.entries()].filter(([, group]) => group.length > 1);

  if (duplicates.length === 0) {
    console.log("✅ Nenhum cliente duplicado encontrado!");
    return;
  }

  console.log(`⚠️  Encontrados ${duplicates.length} telefones com duplicatas:\n`);

  for (const [phone, group] of duplicates) {
    const primary = group[0]; // O mais antigo é o principal
    const toMerge = group.slice(1);

    console.log(`📱 Telefone: ${phone}`);
    console.log(`   ✅ Principal: ${primary.name} (ID: ${primary.id}, criado em: ${primary.createdAt.toLocaleDateString("pt-BR")})`);
    
    for (const dup of toMerge) {
      console.log(`   🔄 Duplicado: ${dup.name} (ID: ${dup.id})`);

      // Transfere agendamentos
      const apptResult = await prisma.appointment.updateMany({
        where: { clientId: dup.id },
        data: { clientId: primary.id },
      });
      console.log(`      → ${apptResult.count} agendamentos transferidos`);

      // Transfere assinaturas (apenas se o principal não tiver)
      const existingSub = await prisma.subscription.findFirst({
        where: { clientId: primary.id, status: "ACTIVE" },
      });
      if (!existingSub) {
        const subResult = await prisma.subscription.updateMany({
          where: { clientId: dup.id },
          data: { clientId: primary.id },
        });
        console.log(`      → ${subResult.count} assinaturas transferidas`);
      } else {
        // Se ambos têm assinatura, cancela a do duplicado
        await prisma.subscription.updateMany({
          where: { clientId: dup.id, status: "ACTIVE" },
          data: { status: "CANCELLED" },
        });
        console.log(`      → Assinaturas do duplicado canceladas (principal já possui)`);
      }

      // Transfere vendas de produtos
      const salesResult = await prisma.productSale.updateMany({
        where: { clientId: dup.id },
        data: { clientId: primary.id },
      });
      if (salesResult.count > 0) console.log(`      → ${salesResult.count} vendas transferidas`);

      // Remove o duplicado
      try {
        await prisma.user.delete({ where: { id: dup.id } });
        console.log(`      → ❌ Duplicado removido do banco`);
      } catch (e) {
        console.log(`      → ⚠️ Não foi possível remover (pode ter outras dependências). Marcando como inativo.`);
        await prisma.user.update({
          where: { id: dup.id },
          data: { name: `[MERGED→${primary.id}] ${dup.name}`, phone: `MERGED_${dup.phone}` },
        });
      }
    }
    console.log("");
  }

  console.log("✅ Merge concluído!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
