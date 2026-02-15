/**
 * Session Storage — Redis primary, in-memory Map fallback (Phase 2)
 * Key: session:{org_id}:{channel}:{user_id}
 * TTL: 1800 seconds. Structure: { org_id, channel, user_id, state, v }.
 */
import { getRedisClient } from "@/lib/redis-client";
import type { ConversationState } from "./conversation-state";

const KEY_PREFIX = "session:";
const SESSION_TTL_SEC = 1800;
const STORAGE_VERSION = 1;

/** In-memory fallback when Redis is down or not configured */
const fallbackStore = new Map<string, { state: ConversationState; expiresAt: number }>();

function buildKey(orgId: string, channel: string, userId: string): string {
  const o = orgId || "_";
  const c = channel || "default";
  return `${KEY_PREFIX}${o}:${c}:${userId}`;
}

export interface SessionPayload {
  org_id: string;
  channel: string;
  user_id: string;
  state: ConversationState;
  v: number;
}

/**
 * Get state from session. Redis first; on failure or no Redis → fallback Map.
 */
export async function getSessionState(
  orgId: string,
  channel: string,
  userId: string
): Promise<ConversationState | null> {
  const key = buildKey(orgId, channel, userId);

  const client = await getRedisClient();
  if (client) {
    try {
      const raw = await client.get(key);
      if (raw) {
        const parsed = JSON.parse(raw) as SessionPayload;
        if (parsed.state && typeof parsed.v === "number") return parsed.state as ConversationState;
      }
    } catch {
      // fall through to fallback
    }
  }

  const fallback = fallbackStore.get(key);
  if (!fallback) return null;
  if (Date.now() > fallback.expiresAt) {
    fallbackStore.delete(key);
    return null;
  }
  return fallback.state;
}

/**
 * Save state to session. Redis set EX 1800; on failure → fallback Map.
 */
export function saveSessionState(
  orgId: string,
  channel: string,
  userId: string,
  state: ConversationState
): void {
  const key = buildKey(orgId, channel, userId);
  const stored: ConversationState = { ...state, lastUpdated: Date.now() };
  const payload: SessionPayload = {
    org_id: orgId || "_",
    channel: channel || "default",
    user_id: userId,
    state: stored,
    v: STORAGE_VERSION,
  };
  const json = JSON.stringify(payload);

  setFallback(key, stored);

  getRedisClient().then((client) => {
    if (client) client.set(key, json, "EX", SESSION_TTL_SEC).catch(() => {});
  });
}

function setFallback(key: string, state: ConversationState): void {
  fallbackStore.set(key, {
    state,
    expiresAt: Date.now() + SESSION_TTL_SEC * 1000,
  });
}

/**
 * Clear session. Redis del; also remove from fallback Map.
 */
export function clearSession(orgId: string, channel: string, userId: string): void {
  const key = buildKey(orgId, channel, userId);
  fallbackStore.delete(key);
  getRedisClient().then((client) => {
    if (client) client.del(key).catch(() => {});
  });
}

/**
 * Cleanup expired entries in fallback Map only (Redis keys expire automatically).
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [key, entry] of fallbackStore.entries()) {
    if (now > entry.expiresAt) fallbackStore.delete(key);
  }
}

/**
 * Active session count (fallback Map only; Redis keys are not counted).
 */
export function getActiveSessionCount(): number {
  const now = Date.now();
  let count = 0;
  for (const entry of fallbackStore.values()) {
    if (now <= entry.expiresAt) count++;
  }
  return count;
}
