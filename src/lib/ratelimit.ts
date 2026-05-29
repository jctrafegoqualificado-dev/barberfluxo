import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ── Redis config check ───────────────────────────────────────────────────────
// Se as env vars não estiverem configuradas (ex: desenvolvimento local),
// os limitadores usam um stub que sempre permite a requisição (fail-open).
// Em produção (Vercel), configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   ?? "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const redisConfigured = Boolean(REDIS_URL && REDIS_TOKEN && REDIS_URL.startsWith("http"));

if (!redisConfigured) {
  console.warn("⚠️ [Ratelimit] Upstash Redis não configurado — rate limiting desativado (fail-open).");
}

// Instância única do Redis (criada só se configurado)
const redis = redisConfigured
  ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
  : null;

// ── Tipo unificado ───────────────────────────────────────────────────────────
// Inclui todos os campos retornados pelo Upstash (limit, remaining, reset)
// para que os consumers possam usá-los sem cast adicional.
interface LimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Timestamp (ms) em que a janela é resetada */
  reset: number;
  pending: Promise<unknown>;
}

interface Limiter {
  limit(key: string): Promise<LimitResult>;
}

// Stub: sempre permite (usado em dev sem Redis)
const noopLimiter: Limiter = {
  limit: async () => ({
    success: true,
    limit: 0,
    remaining: 0,
    reset: Date.now(),
    pending: Promise.resolve(),
  }),
};

// ── Limitadores ──────────────────────────────────────────────────────────────

// 5 tentativas de login por email a cada 15 minutos (sliding window)
export const loginRatelimit: Limiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "15 m"), prefix: "rl:login", analytics: false })
  : noopLimiter;

// 8 agendamentos por IP a cada 10 minutos — previne spam na página pública de booking
export const bookingRatelimit: Limiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(8, "10 m"), prefix: "rl:booking", analytics: false })
  : noopLimiter;

// 30 criações de assinatura por barbearia a cada 15 minutos
export const subscriptionCreateRatelimit: Limiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "15 m"), prefix: "rl:sub-create", analytics: false })
  : noopLimiter;

// 120 chamadas por slug a cada minuto — protege os endpoints /api/v1/ contra abuso
// (N8N normal: ~5-10 calls/conversa; 120/min permite ~12 conversas simultâneas por barbearia)
export const apiV1Ratelimit: Limiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, "1 m"), prefix: "rl:v1", analytics: false })
  : noopLimiter;

// Helpers — extrai IP do request de forma segura
export function getIp(req: { headers: { get(k: string): string | null } }): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
