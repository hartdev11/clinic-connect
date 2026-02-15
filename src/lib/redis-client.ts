/**
 * Redis client (Enterprise AI Platform Hardening)
 * REDIS_URL required when enabled. Used by idempotency layer.
 */
import Redis from "ioredis";

/** Redis URL from env. */
export const REDIS_URL = process.env.REDIS_URL ?? "";

/** Whether Redis is configured. */
export function isRedisConfigured(): boolean {
  return typeof REDIS_URL === "string" && REDIS_URL.length > 0;
}

let _client: Redis | null = null;

/**
 * Get Redis client. Lazy init when REDIS_URL is set. Returns null if not configured.
 */
export async function getRedisClient(): Promise<Redis | null> {
  if (!isRedisConfigured()) return null;
  if (_client) return _client;
  _client = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
  return _client;
}
