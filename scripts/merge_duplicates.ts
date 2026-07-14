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

/**
 * Chave canônica de telefone BR: DDD + últimos 8 dígitos, ignorando o DDI 55 e o
 * 9º dígito. Agrupa como duplicatas números equivalentes digitados de formas
 * diferentes (ex.: "5541998276617" e "41998276617"), que a versão antiga —
 * baseada em dígitos idênticos — deixava passar.
 */
function canonicalPhone(raw: string | null | undefined): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length < 10) return null;
  return d.slice(0, 2) + d.slice(-8);
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`🔍 Buscando clientes duplicados por telefone (canônico: ignora DDI 55 e 9º dígito)...`);
  console.log(apply ? "⚠️  MODO --apply: alterações SERÃO gravadas.\n" : "ℹ️  DRY-RUN (padrão): nada será alterado. Use --apply para efetivar.\n");

  const clients = await prisma.user.findMany({
    where: { role: "CLIENT", phone: { not: null } },
    orderBy: { createdAt: "asc" },
  });

  // Agrupa por telefone canônico (equivalência 55/9º dígito)
  const phoneGroups = new Map<string, typeof clients>();
  for (const c of clients) {
    const key = canonicalPhone(c.phone);
    if (!key) continue;
    if (!phoneGroups.has(key)) phoneGroups.set(key, []);
    phoneGroups.get(key)!.push(c);
  }

  // Filtra grupos com duplicados
  const duplicates = [...phoneGroups.entries()].filter(([, group]) => group.length > 1);

  if (duplicates.length === 0) {
    console.log("✅ Nenhum cliente duplicado encontrado!");
    return;
  }

  console.log(`⚠️  Encontrados ${duplicates.length} telefones com duplicatas:\n`);

  for (const [phone, group] of duplicates) {
    // Escolhe o PRINCIPAL pelo registro mais "rico", não pelo mais antigo — evita
    // mesclar um cliente real (com assinatura/agendamentos) dentro de um cadastro
    // de teste que por acaso é mais velho. Critério: assinatura ativa > nº de
    // assinaturas > nº de agendamentos > mais antigo (desempate).
    const scored = await Promise.all(group.map(async (c) => ({
      c,
      activeSubs: await prisma.subscription.count({ where: { clientId: c.id, status: "ACTIVE" } }),
      subs: await prisma.subscription.count({ where: { clientId: c.id } }),
      appts: await prisma.appointment.count({ where: { clientId: c.id } }),
    })));
    scored.sort((a, b) =>
      b.activeSubs - a.activeSubs ||
      b.subs - a.subs ||
      b.appts - a.appts ||
      a.c.createdAt.getTime() - b.c.createdAt.getTime()
    );
    const primary = scored[0].c;
    const toMerge = scored.slice(1).map((s) => s.c);

    console.log(`📱 Telefone: ${phone}`);
    console.log(`   ✅ Principal: ${primary.name} (ID: ${primary.id}, criado em: ${primary.createdAt.toLocaleDateString("pt-BR")}, assinAtivas=${scored[0].activeSubs}, agend=${scored[0].appts})`);
    
    for (const dup of toMerge) {
      console.log(`   🔄 Duplicado: ${dup.name} (ID: ${dup.id}, tel: ${dup.phone})`);

      // Contagens são só leitura — úteis também no dry-run
      const apptCount = await prisma.appointment.count({ where: { clientId: dup.id } });
      const dupSubCount = await prisma.subscription.count({ where: { clientId: dup.id } });
      const salesCount = await prisma.productSale.count({ where: { clientId: dup.id } });
      const existingSub = await prisma.subscription.findFirst({
        where: { clientId: primary.id, status: "ACTIVE" },
      });

      if (!apply) {
        console.log(`      [dry-run] transferiria ${apptCount} agendamentos, ${salesCount} vendas`);
        console.log(`      [dry-run] ${existingSub ? `cancelaria assinaturas ATIVAS do duplicado (principal já tem)` : `transferiria ${dupSubCount} assinaturas`}`);
        console.log(`      [dry-run] removeria (ou marcaria [MERGED]) o cadastro duplicado`);
        continue;
      }

      // Transfere agendamentos
      const apptResult = await prisma.appointment.updateMany({
        where: { clientId: dup.id },
        data: { clientId: primary.id },
      });
      console.log(`      → ${apptResult.count} agendamentos transferidos`);

      // Transfere assinaturas (apenas se o principal não tiver)
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

  console.log(apply ? "✅ Merge concluído!" : `\nℹ️  DRY-RUN: nada foi alterado. Rode com --apply para efetivar o merge dos ${duplicates.length} grupos acima.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
