/**
 * Phase 6 — Retrain Monitor
 * Daily check: ถ้ามี conversations >= 10000, high_quality >= 2000, days_since_last >= 30
 * → สร้าง notification ใน global/platform_notifications
 * → ส่งอีเมลแจ้ง super_admin
 */
import { db } from "@/lib/firebase-admin";
import { sendRetrainNotificationEmail } from "@/lib/email";

const PLATFORM_NOTIFICATIONS = "platform_notifications";
/** Path: global/model_config (doc in global collection) */
const GLOBAL_MODEL_CONFIG = "model_config";

export interface RetrainConfig {
  last_retrain_date?: string | null;
}

const THRESHOLD_TOTAL = 10000;
const THRESHOLD_HIGH_QUALITY = 2000;
const THRESHOLD_DAYS_SINCE = 30;

export interface RetrainMonitorResult {
  triggered: boolean;
  totalConversations: number;
  highQualityLast30Days: number;
  daysSinceLastRetrain: number;
  lastRetrainDate: string | null;
  notificationId?: string;
  emailSent?: boolean;
}

async function getLastRetrainDate(): Promise<string | null> {
  const doc = await db.collection("global").doc(GLOBAL_MODEL_CONFIG).get();
  if (!doc.exists) return null;
  const d = doc.data();
  return (d?.last_retrain_date as string) ?? null;
}

/**
 * Count conversations — fetch with limit and count (Firestore limit 10000 per query)
 * For high scale, consider aggregation queries or write-time counters
 */
async function countConversations(
  from: Date,
  to: Date,
  adminLabelFilter?: "success" | null
): Promise<number> {
  const Firestore = await import("firebase-admin/firestore");
  const col = db.collection("conversation_feedback");
  let q = col
    .where("createdAt", ">=", Firestore.Timestamp.fromDate(from))
    .where("createdAt", "<=", Firestore.Timestamp.fromDate(to));
  if (adminLabelFilter) {
    q = q.where("adminLabel", "==", adminLabelFilter) as typeof q;
  }
  const snapshot = await q.limit(10001).get();
  return snapshot.size;
}

export async function runRetrainMonitor(): Promise<RetrainMonitorResult> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
  now.setUTCHours(23, 59, 59, 999);

  const lastRetrainStr = await getLastRetrainDate();
  const lastRetrainDate = lastRetrainStr ? new Date(lastRetrainStr) : new Date(0);
  const daysSinceLastRetrain = Math.floor(
    (now.getTime() - lastRetrainDate.getTime()) / 86400000
  );

  const [highQualityLast30Days, totalConversations] = await Promise.all([
    countConversations(thirtyDaysAgo, now, "success"),
    countConversations(lastRetrainDate, now, null),
  ]);

  const triggered =
    totalConversations >= THRESHOLD_TOTAL &&
    highQualityLast30Days >= THRESHOLD_HIGH_QUALITY &&
    daysSinceLastRetrain >= THRESHOLD_DAYS_SINCE;

  let notificationId: string | undefined;
  let emailSent = false;

  if (triggered) {
    const { FieldValue } = await import("firebase-admin/firestore");
    const message = `พร้อม Retrain: มี ${highQualityLast30Days} conversations คุณภาพสูง`;
    const docRef = db.collection(PLATFORM_NOTIFICATIONS).doc();
    await docRef.set({
      type: "retrain_ready",
      message,
      createdAt: FieldValue.serverTimestamp(),
    });
    notificationId = docRef.id;

    const emailResult = await sendRetrainNotificationEmail({
      highQualityCount: highQualityLast30Days,
      totalCount: totalConversations,
    });
    emailSent = emailResult.success;
  }

  return {
    triggered: !!triggered,
    totalConversations,
    highQualityLast30Days,
    daysSinceLastRetrain,
    lastRetrainDate: lastRetrainStr,
    notificationId,
    emailSent,
  };
}
