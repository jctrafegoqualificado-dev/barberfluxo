/**
 * Exporta (somente leitura) TODOS os grupos de clientes duplicados por telefone
 * para uma planilha CSV, para a barbearia revisar e decidir cadastro a cadastro
 * (manter / mesclar / excluir). NÃO altera nada no banco.
 *
 * O arquivo é gravado FORA do repositório (pasta Documentos) porque contém
 * dados pessoais de clientes (nome + telefone) — não deve ir para o Git.
 *
 * Uso:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/export_duplicados_revisao.ts
 */
import { PrismaClient } from "@prisma/client";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

const prisma = new PrismaClient();

function canonicalPhone(raw: string | null | undefined): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length < 10) return null;
  return d.slice(0, 2) + d.slice(-8);
}
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
function namesCompatible(names: string[]): boolean {
  const firsts = names.map((n) => norm(n).split(" ")[0] ?? "");
  const allSameFirst = firsts.every((f) => f && f === firsts[0]);
  const oneIsPrefix = names.some((a) => names.some((b) => a !== b && (norm(a).startsWith(norm(b)) || norm(b).startsWith(norm(a)))));
  return allSameFirst || oneIsPrefix;
}
// Escapa um valor para CSV (separador ';')
const csv = (v: string | number) => {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  const clients = await prisma.user.findMany({
    where: { role: "CLIENT", phone: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, phone: true, createdAt: true },
  });

  const groupsMap = new Map<string, typeof clients>();
  for (const c of clients) {
    const k = canonicalPhone(c.phone);
    if (!k) continue;
    if (!groupsMap.has(k)) groupsMap.set(k, []);
    groupsMap.get(k)!.push(c);
  }
  const dups = [...groupsMap.entries()].filter(([, g]) => g.length > 1);

  const rows: string[] = [];
  rows.push(["Grupo", "Classificação", "Nome", "Telefone", "Assinatura", "Nº Agendamentos", "Sugestão do sistema", "Decisão da barbearia (manter / mesclar / excluir)"].map(csv).join(";"));

  let groupNum = 0;
  for (const [, group] of dups) {
    groupNum++;
    // Dados por cadastro
    const members = await Promise.all(group.map(async (c) => {
      const activeSub = await prisma.subscription.findFirst({
        where: { clientId: c.id, status: "ACTIVE" },
        select: { plan: { select: { name: true } } },
      });
      const anySub = activeSub ? null : await prisma.subscription.findFirst({
        where: { clientId: c.id }, select: { status: true },
      });
      const appts = await prisma.appointment.count({ where: { clientId: c.id } });
      return {
        c,
        activeSubName: activeSub?.plan?.name ?? null,
        subStatus: anySub?.status ?? null,
        appts,
      };
    }));

    const totalActive = members.filter((m) => m.activeSubName).length;
    const compat = namesCompatible(group.map((c) => c.name));
    const classificacao =
      totalActive >= 2 ? "NÃO MESCLAR (2+ assinaturas ativas — provável pessoas diferentes)"
      : !compat ? "REVISAR (nomes diferentes)"
      : "MESCLAR (mesma pessoa)";

    // Ordena p/ sugerir principal (assinatura ativa > agendamentos > mais antigo)
    const ordered = [...members].sort((a, b) =>
      (b.activeSubName ? 1 : 0) - (a.activeSubName ? 1 : 0) ||
      b.appts - a.appts ||
      a.c.createdAt.getTime() - b.c.createdAt.getTime()
    );

    ordered.forEach((m, i) => {
      const assinatura = m.activeSubName ? `ATIVA (${m.activeSubName})` : m.subStatus ? `inativa (${m.subStatus})` : "—";
      let sugestao: string;
      if (classificacao.startsWith("MESCLAR")) sugestao = i === 0 ? "MANTER (principal)" : "mesclar no principal";
      else sugestao = "decidir manualmente";
      rows.push([
        groupNum, classificacao, m.c.name, m.c.phone ?? "", assinatura, m.appts, sugestao, "",
      ].map(csv).join(";"));
    });
    rows.push(""); // linha em branco separando grupos
  }

  const outPath = path.join(os.homedir(), "Documents", "duplicados_para_revisar.csv");
  fs.writeFileSync(outPath, "﻿" + rows.join("\r\n"), "utf8"); // BOM p/ acentos no Excel

  console.log(`\n✅ Planilha gerada: ${outPath}`);
  console.log(`   ${dups.length} grupos, ${clients.filter((c) => canonicalPhone(c.phone)).length} cadastros analisados.`);
  console.log(`   Abra no Excel/Google Sheets, preencha a coluna "Decisão da barbearia" e envie.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
