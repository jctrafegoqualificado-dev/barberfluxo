/**
 * Roda o app ou o Prisma apontando para o banco de HOMOLOGAÇÃO (.env.homolog).
 *
 *   npm run homolog:dev      → app em http://localhost:3000 ligado na homologação
 *   npm run homolog:push     → cria/atualiza as tabelas a partir do schema.prisma
 *   npm run homolog:seed     → popula com dados fictícios
 *   npm run homolog:studio   → Prisma Studio na homologação
 *
 * Integrações externas (WhatsApp, e-mail, Mercado Pago, Redis, Sentry) ficam
 * DESLIGADAS: o código já trata chave vazia como "não configurado". Para ligar
 * uma delas em modo teste (ex.: Mercado Pago sandbox), coloque a chave de teste
 * no .env.homolog — o que estiver lá tem prioridade.
 *
 * Variáveis definidas aqui têm prioridade sobre o .env (nem o Next nem o Prisma
 * sobrescrevem o que já veio do processo), então o .env de produção não vaza.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const MODES = {
  dev: { bin: "node_modules/next/dist/bin/next", args: ["dev"], url: "DATABASE_URL" },
  push: { bin: "node_modules/prisma/build/index.js", args: ["db", "push", "--skip-generate"], url: "DIRECT_URL" },
  seed: { bin: "node_modules/ts-node/dist/bin.js", args: ["prisma/seed-homolog.ts"], url: "DIRECT_URL" },
  studio: { bin: "node_modules/prisma/build/index.js", args: ["studio"], url: "DIRECT_URL" },
};

// Chaves que, vazias, desligam a integração correspondente.
const DISABLED = [
  "EVOLUTION_API_URL", "EVOLUTION_SERVER_URL", "EVOLUTION_GLOBAL_API_KEY", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE_NAME",
  "ZAPI_INSTANCE_ID", "ZAPI_TOKEN", "ZAPI_CLIENT_TOKEN",
  "N8N_EVOLUTION_WEBHOOK_URL",
  "RESEND_API_KEY",
  "MERCADOPAGO_ACCESS_TOKEN", "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY", "MERCADOPAGO_WEBHOOK_SECRET",
  "MP_APP_CLIENT_ID", "MP_APP_CLIENT_SECRET", "MP_OAUTH_REDIRECT_URI",
  "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
  "SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN", "SENTRY_AUTH_TOKEN",
];

// Segredos que não podem ser os mesmos de produção.
const LOCAL_DEFAULTS = {
  JWT_SECRET: "homolog-jwt-secret-nao-usar-em-producao",
  CRON_SECRET: "homolog-cron-secret",
  PUBLIC_API_KEY: "homolog-public-api-key",
  NEXTAUTH_URL: "http://localhost:3000",
  APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

function parseEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

const projectRef = (url) => url?.match(/postgres\.([a-z0-9]+):/)?.[1] ?? url?.match(/@db\.([a-z0-9]+)\.supabase\.co/)?.[1];

const mode = MODES[process.argv[2]];
if (!mode) {
  console.error(`Uso: node scripts/homolog.mjs <${Object.keys(MODES).join("|")}>`);
  process.exit(1);
}

const homolog = parseEnv(".env.homolog");
const prod = parseEnv(".env");

const dbUrl = homolog[mode.url];
if (!dbUrl || dbUrl.includes("[YOUR-PASSWORD]")) {
  console.error(`❌ ${mode.url} ausente ou sem senha no .env.homolog.`);
  process.exit(1);
}

// Trava: nunca rodar contra o mesmo projeto do .env (produção).
const ref = projectRef(dbUrl);
if (!ref || ref === projectRef(prod.DATABASE_URL) || ref === projectRef(prod.DIRECT_URL)) {
  console.error("❌ O .env.homolog aponta para o MESMO banco do .env (produção). Abortado.");
  process.exit(1);
}

const env = { ...process.env };
for (const k of DISABLED) env[k] = "";
Object.assign(env, LOCAL_DEFAULTS);
// O que o .env.homolog define vence (ex.: chave sandbox do Mercado Pago).
for (const [k, v] of Object.entries(homolog)) if (k !== "DATABASE_URL" && k !== "DIRECT_URL") env[k] = v;
env.DATABASE_URL = dbUrl;
env.HOMOLOG = "1"; // o seed de homologação (que apaga o banco) só roda com isto

const ligadas = DISABLED.filter((k) => env[k]);
console.log(`\n🧪 HOMOLOGAÇÃO — banco ${ref} (${mode.url})`);
console.log(ligadas.length ? `   Integrações ligadas pelo .env.homolog: ${ligadas.join(", ")}` : "   Integrações externas: todas desligadas");
console.log("");

const child = spawn(process.execPath, [mode.bin, ...mode.args], { env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
