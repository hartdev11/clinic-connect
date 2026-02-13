/**
 * Background Cleanup Utilities — รองรับ cron job
 * - reset daily usage (rotate llm_usage_daily เก่า)
 * - purge old rate_limit_events
 * - archive old audit_logs (optional)
 */
import { db } from "@/lib/firebase-admin";
import { getTodayKeyBangkok } from "@/lib/timezone";
import { purgeOldStripeEvents } from "@/lib/stripe-cleanup";

const DAYS_TO_KEEP_LLM_USAGE = 7;
const DAYS_TO_KEEP_RATE_LIMIT = 1;
const DAYS_TO_KEEP_AUDIT = 90;

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function purgeOldLLMUsage(): Promise<number> {
  const cutoff = daysAgo(DAYS_TO_KEEP_LLM_USAGE);
  const today = getTodayKeyBangkok();
  const snap = await db.collection("llm_usage_daily").get();
  let deleted = 0;
  const batch = db.batch();
  for (const doc of snap.docs) {
    const date = doc.data()?.date ?? doc.id.split("_").pop();
    if (date && date < cutoff && date !== today) {
      batch.delete(doc.ref);
      deleted++;
    }
  }
  if (deleted > 0) await batch.commit();
  return deleted;
}

export async function purgeOldRateLimitEvents(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_TO_KEEP_RATE_LIMIT);
  let deleted = 0;
  const snap1 = await db.collection("rate_limit_events").get();
  const batch1 = db.batch();
  for (const doc of snap1.docs) {
    const updatedAt = doc.data()?.updatedAt;
    const ts = updatedAt?.toMillis?.() ?? 0;
    if (ts > 0 && ts < cutoff.getTime()) {
      batch1.delete(doc.ref);
      deleted++;
    }
  }
  if (deleted > 0) await batch1.commit();
  const snap2 = await db.collection("rate_limit_sliding").get();
  const batch2 = db.batch();
  let batch2Count = 0;
  for (const doc of snap2.docs) {
    const updatedAt = doc.data()?.updatedAt;
    const ts = updatedAt?.toMillis?.() ?? (updatedAt instanceof Date ? updatedAt.getTime() : 0);
    if (ts > 0 && ts < cutoff.getTime()) {
      batch2.delete(doc.ref);
      batch2Count++;
      deleted++;
    }
  }
  if (batch2Count > 0) await batch2.commit();
  return deleted;
}

export async function purgeOldLineWebhookEvents(): Promise<number> {
  const snap = await db.collection("line_webhook_events").get();
  const now = Date.now();
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

export async function purgeOldStripeEventsWrapper(): Promise<number> {
  return purgeOldStripeEvents();
}

/** Enterprise: Purge AI activity logs เก่ากว่า RETENTION_DAYS */
const AI_ACTIVITY_RETENTION_DAYS = 30;
export async function purgeOldAIActivityLogs(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - AI_ACTIVITY_RETENTION_DAYS);
  let deleted = 0;
  const snap = await db.collection("ai_activity_logs").get();
  const batch = db.batch();
  for (const doc of snap.docs) {
    const d = doc.data();
    const t = d.created_at?.toMillis?.() ?? (d.created_at ? new Date(d.created_at).getTime() : 0);
    if (t > 0 && t < cutoff.getTime()) {
      batch.delete(doc.ref);
      deleted++;
    }
  }
  if (deleted > 0) await batch.commit();
  return deleted;
}

/** Enterprise: Purge audit logs เก่ากว่า DAYS_TO_KEEP_AUDIT — Data Retention Policy */
export async function purgeOldAuditLogs(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_TO_KEEP_AUDIT);
  let deleted = 0;
  const snap = await db.collection("audit_logs").get();
  const batch = db.batch();
  for (const doc of snap.docs) {
    const ts = doc.data()?.timestamp;
    const t = ts?.toMillis?.() ?? (ts ? new Date(ts).getTime() : 0);
    if (t > 0 && t < cutoff.getTime()) {
      batch.delete(doc.ref);
      deleted++;
    }
  }
  if (deleted > 0) await batch.commit();
  return deleted;
}

export async function runAllCleanup(): Promise<{
  llmUsage: number;
  rateLimit: number;
  lineWebhook: number;
  stripeEvents: number;
  auditLogs: number;
  aiActivityLogs: number;
}> {
  const [llmUsage, rateLimit, lineWebhook, stripeEvents, auditLogs, aiActivityLogs] = await Promise.all([
    purgeOldLLMUsage(),
    purgeOldRateLimitEvents(),
    purgeOldLineWebhookEvents(),
    purgeOldStripeEvents(),
    purgeOldAuditLogs(),
    purgeOldAIActivityLogs(),
  ]);
  return { llmUsage, rateLimit, lineWebhook, stripeEvents, auditLogs, aiActivityLogs };
}
