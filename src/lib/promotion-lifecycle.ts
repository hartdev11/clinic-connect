/**
 * Promotion Lifecycle — cron every 5 min
 * - scheduled → active when now >= startAt
 * - active → expired when now > endAt
 * - any → archived when now > autoArchiveAt
 */
import { db } from "@/lib/firebase-admin";
import type { Timestamp } from "firebase-admin/firestore";

const COLLECTION = "promotions";

export interface PromotionLifecycleResult {
  activated: number;
  expired: number;
  archived: number;
}

export async function runPromotionLifecycle(): Promise<PromotionLifecycleResult> {
  const Firestore = await import("firebase-admin/firestore");
  const now = Firestore.Timestamp.now();
  const nowDate = now.toDate();

  const result: PromotionLifecycleResult = { activated: 0, expired: 0, archived: 0 };

  const snapshot = await db
    .collection(COLLECTION)
    .where("status", "in", ["scheduled", "active"])
    .limit(500)
    .get();

  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const d = doc.data();
    const status = d.status as string;
    const startAt = d.startAt as Timestamp | null;
    const endAt = d.endAt as Timestamp | null;
    const autoArchiveAt = d.autoArchiveAt as Timestamp | null;

    let newStatus: string | null = null;

    if (autoArchiveAt && autoArchiveAt.toDate().getTime() <= nowDate.getTime()) {
      newStatus = "archived";
      result.archived++;
    } else if (status === "scheduled" && startAt && startAt.toDate().getTime() <= nowDate.getTime()) {
      newStatus = "active";
      result.activated++;
    } else if (status === "active" && endAt && endAt.toDate().getTime() < nowDate.getTime()) {
      newStatus = "expired";
      result.expired++;
    }

    if (newStatus) {
      batch.update(doc.ref, { status: newStatus, updatedAt: Firestore.Timestamp.now() });
    }
  }

  if (result.activated + result.expired + result.archived > 0) {
    await batch.commit();
  }

  return result;
}
