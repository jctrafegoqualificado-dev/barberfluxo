/**
 * cache.ts — Helper de cache Redis para KPIs e queries pesadas
 *
 * Usa o mesmo Upstash Redis já configurado para rate limiting.
 * Resiliente: se o Redis estiver fora, getCached retorna null e
 * a requisição cai para o banco normalmente — zero downtime.
 *
 * Prefixos de chave:
 *   dash:{barbershopId}:{period}:{date}:{from}:{to}   → dashboard KPIs (TTL 60–300s)
 */

import { Redis } from "@upstash/redis";

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   ?? "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const redisAvailable = Boolean(REDIS_URL && REDIS_TOKEN && REDIS_URL.startsWith("http"));

// Em dev local sem Redis configurado, todas as ops de cache retornam null/void
const redis = redisAvailable
  ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
  : null;

/**
 * Lê um valor do cache.
 * Retorna null se não encontrado, expirado ou Redis indisponível.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    return await redis.get<T>(key);
  } catch (err) {
    // Redis fora — degrada graciosamente para o banco
    console.warn("[cache] get falhou, usando banco:", (err as Error).message);
    return null;
  }
}

/**
 * Armazena um valor no cache com TTL em segundos.
 * Fire-and-forget: falhas não afetam a resposta ao cliente.
 *
 * @param key        Chave única (inclua barbershopId para isolamento por tenant)
 * @param value      Qualquer objeto serializável (Upstash serializa como JSON)
 * @param ttlSeconds Tempo de vida em segundos (60 = 1min, 300 = 5min)
 */
export async function setCached(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, value as Parameters<typeof redis.setex>[2]);
  } catch (err) {
    // Falha silenciosa — não compromete a resposta
    console.warn("[cache] set falhou:", (err as Error).message);
  }
}

/**
 * Invalida (deleta) uma chave do cache manualmente.
 * Útil quando um dado é gravado e queremos forçar refresh imediato.
 */
export async function invalidateCache(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Silencioso
  }
}

/**
 * Monta a chave de cache do dashboard garantindo isolamento por tenant e período.
 */
export function dashboardCacheKey(
  barbershopId: string,
  period: string,
  brDateStr: string,
  customFrom?: string | null,
  customTo?: string | null,
): string {
  return `dash:${barbershopId}:${period}:${brDateStr}:${customFrom ?? ""}:${customTo ?? ""}`;
}
