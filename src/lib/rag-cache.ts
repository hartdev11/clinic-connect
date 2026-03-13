/**
 * Phase 14 — RAG Embedding + Search Result Cache
 * Embedding: embed:{md5(query)} TTL 3600s
 * Search: rag:{orgId}:{md5(query)} TTL 300s, invalidate on knowledge update
 */
import { createHash } from "crypto";
import { getRedisClient, isRedisConfigured } from "@/lib/redis-client";

const EMBED_PREFIX = "embed:";
const RAG_PREFIX = "rag:";
/** Source suffix to avoid collision: kb = knowledge-brain, topics = knowledge topics */
export type RagCacheSource = "kb" | "topics";
const EMBED_TTL = 3600;
const RAG_TTL = 300;

function md5(text: string): string {
  return createHash("md5").update(text, "utf8").digest("hex");
}

/** Get cached embedding or null (model ensures different embedding models don't collide) */
export async function getCachedEmbedding(
  queryText: string,
  model = "default"
): Promise<number[] | null> {
  if (!isRedisConfigured()) return null;
  const redis = await getRedisClient();
  if (!redis) return null;
  try {
    const key = `${EMBED_PREFIX}${model}:${md5(queryText)}`;
    const raw = await redis.get(key);
    if (!raw) return null;
    const arr = JSON.parse(raw) as number[];
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

/** Set embedding in cache */
export async function setCachedEmbedding(
  queryText: string,
  embedding: number[],
  model = "default"
): Promise<void> {
  if (!isRedisConfigured()) return;
  const redis = await getRedisClient();
  if (!redis) return;
  try {
    const key = `${EMBED_PREFIX}${model}:${md5(queryText)}`;
    await redis.setex(key, EMBED_TTL, JSON.stringify(embedding));
  } catch (err) {
    console.warn("[RAGCache] setCachedEmbedding error:", (err as Error)?.message?.slice(0, 80));
  }
}

/** Get cached RAG search results or null */
export async function getCachedRagResults<T = Array<{ id: string; score?: number; metadata?: Record<string, unknown> }>>(
  orgId: string,
  query: string,
  source: RagCacheSource = "kb"
): Promise<T | null> {
  if (!isRedisConfigured()) return null;
  const redis = await getRedisClient();
  if (!redis) return null;
  try {
    const key = `${RAG_PREFIX}${orgId}:${source}:${md5(query)}`;
    const raw = await redis.get(key);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as T) : null;
  } catch {
    return null;
  }
}

/** Set RAG search results in cache */
export async function setCachedRagResults(
  orgId: string,
  query: string,
  results: Array<{ id: string; score?: number; metadata?: Record<string, unknown> }>,
  source: RagCacheSource = "kb"
): Promise<void> {
  if (!isRedisConfigured()) return;
  const redis = await getRedisClient();
  if (!redis) return;
  try {
    const key = `${RAG_PREFIX}${orgId}:${source}:${md5(query)}`;
    await redis.setex(key, RAG_TTL, JSON.stringify(results));
  } catch (err) {
    console.warn("[RAGCache] setCachedRagResults error:", (err as Error)?.message?.slice(0, 80));
  }
}

/** Invalidate all RAG search cache for org (on knowledge update) */
export async function invalidateOrgRagCache(orgId: string): Promise<number> {
  if (!isRedisConfigured()) return 0;
  const redis = await getRedisClient();
  if (!redis) return 0;
  try {
    const pattern = `${RAG_PREFIX}${orgId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    await redis.del(...keys);
    return keys.length;
  } catch (err) {
    console.warn("[RAGCache] invalidateOrgRagCache error:", (err as Error)?.message?.slice(0, 80));
    return 0;
  }
}
