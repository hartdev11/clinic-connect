/**
 * Redis client (ioredis) — optional. Used by idempotency, caches, BullMQ queues.
 *
 * - Set `REDIS_URL` to a **TCP** URL: `redis://...` or `rediss://...` (TLS).
 * - **Do not** put Upstash **REST** URLs (`https://...`) here — ioredis cannot use them; leave unset to disable Redis.
 * - Invalid / unreachable hosts: lazy connect + limited retries; errors are logged, not thrown as unhandled.
 */
import Redis from "ioredis";
import type { RedisOptions } from "ioredis";

const raw = process.env.REDIS_URL?.trim() ?? "";

/** Redis TCP URL only. Rejects https:// REST URLs and other non-redis schemes. */
export function isValidRedisUrlForIoredis(url: string): boolean {
  if (!url) return false;
  return /^rediss?:\/\//i.test(url);
}

/** Exported for diagnostics (trimmed). */
export const REDIS_URL = raw;

export function isRedisConfigured(): boolean {
  return isValidRedisUrlForIoredis(REDIS_URL);
}

const REDIS_OPTIONS: RedisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  retryStrategy: (times: number) => {
    if (times > 8) return null;
    return Math.min(times * 200, 4000);
  },
};

let _shared: Redis | null = null;

/**
 * Single shared ioredis connection for BullMQ queues and helpers.
 * Returns null when Redis is not configured or URL is not redis(s)://
 */
export function getSharedRedisConnection(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (_shared) return _shared;
  _shared = new Redis(REDIS_URL, REDIS_OPTIONS);
  _shared.on("error", (err) => {
    console.warn("[redis]", err.message);
  });
  return _shared;
}

/**
 * Same as {@link getSharedRedisConnection} — async for call sites that already await.
 */
export async function getRedisClient(): Promise<Redis | null> {
  return Promise.resolve(getSharedRedisConnection());
}
