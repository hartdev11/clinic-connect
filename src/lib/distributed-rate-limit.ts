/**
 * Distributed Rate Limit — Firestore transaction, sliding window
 * Multi-instance safe. No in-memory fallback.
 */
import { db } from "@/lib/firebase-admin";

const COLLECTION = "rate_limit_sliding";

export class RateLimitExceededError extends Error {
  constructor(
    public readonly key: string,
    public readonly retryAfterMs: number
  ) {
    super("RATE_LIMIT_EXCEEDED");
    this.name = "RateLimitExceededError";
  }
}

/**
 * Sliding window: เก็บ timestamps ของ request ใน windowSeconds ล่าสุด
 * ถ้า count >= limit → throw RateLimitExceededError
 */
export async function checkDistributedRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  correlationId?: string
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  const docRef = db.collection(COLLECTION).doc(key);

  try {
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      const data = doc.data() ?? {};
      const timestamps: number[] = Array.isArray(data.timestamps) ? data.timestamps : [];
      const filtered = timestamps.filter((t) => t >= windowStart);
      if (filtered.length >= limit) {
        const oldestInWindow = Math.min(...filtered);
        const retryAfterMs = Math.max(0, oldestInWindow + windowSeconds * 1000 - now);
        throw new RateLimitExceededError(key, retryAfterMs);
      }
      filtered.push(now);
      const toStore = filtered.slice(-limit * 2);
      const payload: Record<string, unknown> = {
        timestamps: toStore,
        updatedAt: new Date(),
      };
      if (correlationId != null) payload._correlation = correlationId;
      tx.set(docRef, payload, { merge: true });
    });
    return { allowed: true };
  } catch (err) {
    if (err instanceof RateLimitExceededError) {
      return { allowed: false, retryAfterMs: err.retryAfterMs };
    }
    throw err;
  }
}

/** IP: 5 req / 10 sec */
export const IP_LIMIT = { windowSeconds: 10, max: 5 };

/** Org chat: 30 req / min */
export const ORG_CHAT_LIMIT = { windowSeconds: 60, max: 30 };

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
