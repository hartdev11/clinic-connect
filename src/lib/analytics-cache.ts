/**
 * Optional Redis cache for aggregated analytics (TTL 5–10 min).
 * When REDIS_URL is not set, get/set are no-ops (cache miss).
 */
import { getRedisClient } from "./redis-client";
import { recordCacheHit, recordCacheMiss } from "./observability/cache-metrics";

const TTL_SECONDS = 300; // 5 min

export function analyticsCacheKey(prefix: string, parts: (string | number)[]): string {
  return `analytics:${prefix}:${parts.join(":")}`;
}

/** Get cached JSON. Returns null on miss or when Redis is not configured. */
export async function getAnalyticsCached<T>(key: string): Promise<T | null> {
  const redis = await getRedisClient();
  if (!redis) {
    recordCacheMiss();
    return null;
  }
  try {
    const raw = await redis.get(key);
    if (raw == null) {
      recordCacheMiss();
      return null;
    }
    recordCacheHit();
    return JSON.parse(raw) as T;
  } catch {
    recordCacheMiss();
    return null;
  }
}

/** Set cache with TTL. No-op when Redis is not configured. */
export async function setAnalyticsCached(key: string, value: unknown, ttlSeconds: number = TTL_SECONDS): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // ignore
  }
}
