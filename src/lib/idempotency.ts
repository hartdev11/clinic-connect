/**
 * Idempotency layer (Enterprise AI Platform Hardening)
 * LINE webhook: checkOrSetIdempotency(eventId) + setLineEventReply(eventId, replyJson).
 * When REDIS_URL is not set, behaves as non-duplicate and no-op for set (no behavior change).
 */
import { getRedisClient } from "@/lib/redis-client";

const LINE_KEY_PREFIX = "idem:line:";
const LINE_TTL_SEC = 86400;

export interface IdempotencyRecord {
  key: string;
  result?: unknown;
  createdAt: string;
  ttlSec: number;
}

/**
 * Check or set LINE event idempotency.
 * SET idem:line:{eventId} "" NX EX 86400.
 * If key already exists (duplicate) → { duplicate: true }.
 * If set success → { duplicate: false }.
 * If Redis not configured → { duplicate: false } (allow request).
 */
export async function checkOrSetIdempotency(eventId: string): Promise<{ duplicate: boolean }> {
  const client = await getRedisClient();
  if (!client) return { duplicate: false };

  const key = `${LINE_KEY_PREFIX}${eventId}`;
  const result = await client.set(key, "", "EX", LINE_TTL_SEC, "NX");
  return { duplicate: result !== "OK" };
}

/**
 * After reply: SET idem:line:{eventId} replyJson EX 86400.
 * No-op if Redis not configured.
 */
export async function setLineEventReply(eventId: string, replyJson: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  const key = `${LINE_KEY_PREFIX}${eventId}`;
  await client.set(key, replyJson, "EX", LINE_TTL_SEC);
}

/**
 * Check if idempotency key was already used. (Generic; for other flows later.)
 */
export async function getIdempotencyResult(_key: string): Promise<unknown | null> {
  return null;
}

/**
 * Store idempotency result. (Generic; for other flows later.)
 */
export async function setIdempotencyResult(_key: string, _result: unknown, _ttlSec: number): Promise<void> {}

/**
 * Generate idempotency key.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
