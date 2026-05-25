import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Redis client — usa as env vars UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// 5 tentativas de login por email a cada 15 minutos (sliding window)
export const loginRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  prefix: "rl:login",
  analytics: false,
});

// 8 agendamentos por IP a cada 10 minutos — previne spam na página pública de booking
export const bookingRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(8, "10 m"),
  prefix: "rl:booking",
  analytics: false,
});

// 30 criações de assinatura por barbearia a cada 15 minutos
export const subscriptionCreateRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "15 m"),
  prefix: "rl:sub-create",
  analytics: false,
});

// Helpers — extrai IP do request de forma segura
export function getIp(req: { headers: { get(k: string): string | null } }): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
