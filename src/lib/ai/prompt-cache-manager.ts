/**
 * Phase 12 — Prompt Cache Manager
 * Cache: system_prompt + rag_context + history (NOT the new user message)
 * Key: prompt_cache:{orgId}:{md5(system+rag+history)}
 * TTL: 300 seconds
 * Cost discount: cached input $0.025/1M vs $0.10/1M (75% off)
 */
import { createHash } from "crypto";
import { getRedisClient, isRedisConfigured } from "@/lib/redis-client";

const TTL_SECONDS = 300;
const CACHE_KEY_PREFIX = "prompt_cache:";

export interface PromptCacheContext {
  systemPrompt: string;
  ragContext: string;
  history: string;
}

export interface PromptCacheResult {
  /** Cached prefix (system + rag + history). Append new user message after. */
  cachedPrefix: string;
  cacheHit: boolean;
  cacheKey?: string;
}

function md5(data: string): string {
  return createHash("md5").update(data, "utf8").digest("hex");
}

function cacheKey(orgId: string, context: PromptCacheContext): string {
  const combined = `${context.systemPrompt}\n---\n${context.ragContext}\n---\n${context.history}`;
  const hash = md5(combined);
  return `${CACHE_KEY_PREFIX}${orgId}:${hash}`;
}

/**
 * getOrCreate — Returns cached prompt prefix or builds and caches it.
 * New user message must be appended AFTER the cached content.
 */
export async function getOrCreate(
  orgId: string,
  context: PromptCacheContext
): Promise<PromptCacheResult> {
  if (!isRedisConfigured()) {
    const combined = `${context.systemPrompt}\n---\n${context.ragContext}\n---\n${context.history}`;
    return { cachedPrefix: combined, cacheHit: false };
  }

  const key = cacheKey(orgId, context);
  const redis = await getRedisClient();
  if (!redis) {
    const combined = `${context.systemPrompt}\n---\n${context.ragContext}\n---\n${context.history}`;
    return { cachedPrefix: combined, cacheHit: false };
  }

  try {
    const cached = await redis.get(key);
    if (cached) {
      return { cachedPrefix: cached, cacheHit: true, cacheKey: key };
    }
  } catch (err) {
    console.warn("[PromptCacheManager] Redis get error:", (err as Error)?.message?.slice(0, 80));
  }

  const combined = `${context.systemPrompt}\n---\n${context.ragContext}\n---\n${context.history}`;

  try {
    await redis.setex(key, TTL_SECONDS, combined);
  } catch (err) {
    console.warn("[PromptCacheManager] Redis set error:", (err as Error)?.message?.slice(0, 80));
  }

  return { cachedPrefix: combined, cacheHit: false, cacheKey: key };
}

/**
 * Invalidate all prompt cache for org (on knowledge base update).
 * Deletes keys matching prompt_cache:{orgId}:*
 */
export async function invalidateOrgCache(orgId: string): Promise<number> {
  if (!isRedisConfigured()) return 0;

  const redis = await getRedisClient();
  if (!redis) return 0;

  try {
    const { invalidateOrgRagCache } = await import("@/lib/rag-cache");
    void invalidateOrgRagCache(orgId);

    const pattern = `${CACHE_KEY_PREFIX}${orgId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    await redis.del(...keys);
    return keys.length;
  } catch (err) {
    console.warn("[PromptCacheManager] invalidateOrgCache error:", (err as Error)?.message?.slice(0, 80));
    return 0;
  }
}
