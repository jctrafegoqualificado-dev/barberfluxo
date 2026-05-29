import { Redis } from "@upstash/redis";

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   ?? "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const redisConfigured = Boolean(REDIS_URL && REDIS_TOKEN && REDIS_URL.startsWith("http"));

const redis = redisConfigured
  ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
  : null;

const TTL_SECONDS = 60 * 60 * 48; // 48h — se o job parar de rodar, o status some

export interface CronHealthEntry {
  lastRun: string;
  status: "ok" | "error";
  durationMs: number;
  result: Record<string, unknown>;
}

export async function setCronHealth(
  jobName: string,
  status: "ok" | "error",
  durationMs: number,
  result: Record<string, unknown>
): Promise<void> {
  if (!redis) return;
  const entry: CronHealthEntry = {
    lastRun: new Date().toISOString(),
    status,
    durationMs,
    result,
  };
  await redis.set(`cron:health:${jobName}`, JSON.stringify(entry), { ex: TTL_SECONDS });
}

export async function getAllCronHealth(
  jobNames: string[]
): Promise<Record<string, CronHealthEntry | null>> {
  if (!redis) return Object.fromEntries(jobNames.map((n) => [n, null]));
  const entries = await Promise.all(
    jobNames.map(async (name) => {
      const raw = await redis!.get<string>(`cron:health:${name}`);
      if (!raw) return [name, null];
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return [name, parsed as CronHealthEntry];
      } catch {
        return [name, null];
      }
    })
  );
  return Object.fromEntries(entries);
}
