/**
 * Rate Limit Store Abstraction — Redis-ready / Firestore-backed
 * ตอนนี้ใช้ memory; เปลี่ยนเป็น Firestore เมื่อ scale multi-instance
 */
const RATE_LIMIT_USE_FIRESTORE = process.env.RATE_LIMIT_USE_FIRESTORE === "true";

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitEntry | null>;
  incr(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

const memoryStore = new Map<string, { count: number; resetAt: number }>();

export const memoryRateLimitStore: RateLimitStore = {
  async get(key: string) {
    return memoryStore.get(key) ?? null;
  },
  async incr(key: string, windowMs: number) {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const k = `${key}:${windowStart}`;
    const entry = memoryStore.get(k);
    if (!entry) {
      const v = { count: 1, resetAt: windowStart + windowMs };
      memoryStore.set(k, v);
      return v;
    }
    entry.count += 1;
    return entry;
  },
};

async function createFirestoreRateLimitStore(): Promise<RateLimitStore> {
  const { db } = await import("@/lib/firebase-admin");
  const { FieldValue } = await import("firebase-admin/firestore");
  const COLLECTION = "rate_limit_events";
  return {
    async get(key: string) {
      const doc = await db.collection(COLLECTION).doc(key).get();
      if (!doc.exists) return null;
      const d = doc.data();
      return { count: d?.count ?? 0, resetAt: d?.resetAt ?? 0 };
    },
    async incr(key: string, windowMs: number) {
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const resetAt = windowStart + windowMs;
      const docRef = db.collection(COLLECTION).doc(key);
      await docRef.set(
        {
          count: FieldValue.increment(1),
          resetAt,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      const snap = await docRef.get();
      const count = snap.data()?.count ?? 1;
      return { count, resetAt };
    },
  };
}

let _store: RateLimitStore | null = null;

export async function getRateLimitStore(): Promise<RateLimitStore> {
  if (_store) return _store;
  _store = RATE_LIMIT_USE_FIRESTORE
    ? await createFirestoreRateLimitStore()
    : memoryRateLimitStore;
  return _store;
}
