/**
 * Stripe Idempotency Cleanup — ลบ stripe_events เก่าที่ expires_at < now
 */
import { db } from "@/lib/firebase-admin";

const COLLECTION = "stripe_events";

export async function purgeOldStripeEvents(): Promise<number> {
  const now = Date.now();
  const snap = await db.collection(COLLECTION).get();
  let deleted = 0;
  const batch = db.batch();
  for (const doc of snap.docs) {
    const expires = doc.data()?.expires_at;
    const ts = expires?.toMillis?.() ?? new Date(expires)?.getTime?.() ?? 0;
    if (ts > 0 && ts < now) {
      batch.delete(doc.ref);
      deleted++;
    }
  }
  if (deleted > 0) await batch.commit();
  return deleted;
}
