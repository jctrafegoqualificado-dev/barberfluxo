/**
 * Console SQL de terminal — usa a conexão do DATABASE_URL do .env.
 *
 *   npm run db:sql -- "SELECT count(*) FROM \"Barber\""
 *   npm run db:sql -- --file caminho/consulta.sql
 *
 * Por segurança, comandos que escrevem (INSERT/UPDATE/DELETE/ALTER/DROP/TRUNCATE/
 * CREATE) só rodam com a flag --write. Isto aqui aponta para PRODUÇÃO.
 *
 *   npm run db:sql -- --write "ALTER TABLE ..."
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const write = argv.includes("--write");
const fileIdx = argv.indexOf("--file");
const sql = fileIdx !== -1
  ? readFileSync(argv[fileIdx + 1], "utf8")
  : argv.filter((a) => a !== "--write").join(" ").trim();

if (!sql) {
  console.error('Uso: npm run db:sql -- "SELECT ..."   |   npm run db:sql -- --file consulta.sql');
  process.exit(1);
}

const WRITES = /^\s*(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE)\b/i;
if (WRITES.test(sql) && !write) {
  console.error("Este comando ESCREVE no banco de produção. Repita com --write se for isso mesmo.");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const rows = await prisma.$queryRawUnsafe(sql);
  // BigInt (count, sum) não sobrevive ao JSON.stringify padrão.
  const safe = JSON.parse(JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
  if (Array.isArray(safe) && safe.length > 0) {
    console.table(safe);
    console.log(`${safe.length} linha(s).`);
  } else {
    console.log("Sucesso. Nenhuma linha retornada.");
  }
} catch (e) {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
