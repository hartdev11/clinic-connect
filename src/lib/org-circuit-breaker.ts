/**
 * Org-Level AI Circuit Breaker
 * ถ้า org โดน rate-limit > X ครั้งใน 1 ชม. หรือ error LLM > Y%
 * → block ชั่วคราว 10 นาที + audit log
 */
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { writeAuditLog } from "@/lib/audit-log";
import { log } from "@/lib/logger";

const COLLECTION = "org_circuit_breaker";
const RATE_LIMIT_THRESHOLD = 10; // ครั้งต่อชม.
const ERROR_RATIO_THRESHOLD = 0.5; // 50%
const MIN_REQUESTS_FOR_ERROR_RATIO = 5;
const COOLDOWN_MS = 10 * 60 * 1000; // 10 นาที

function getHourKey(): string {
  const d = new Date();
  return d.toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

export async function recordRateLimitHit(orgId: string): Promise<void> {
  const key = `${orgId}_rate_${getHourKey()}`;
  await db.collection(COLLECTION).doc(key).set(
    { count: FieldValue.increment(1), org_id: orgId, type: "rate_limit", hour: getHourKey() },
    { merge: true }
  );
}

export async function recordLLMError(orgId: string): Promise<void> {
  const key = `${orgId}_error_${getHourKey()}`;
  await db.collection(COLLECTION).doc(key).set(
    { count: FieldValue.increment(1), org_id: orgId, type: "llm_error", hour: getHourKey() },
    { merge: true }
  );
}

export async function recordLLMSuccess(orgId: string): Promise<void> {
  const key = `${orgId}_success_${getHourKey()}`;
  await db.collection(COLLECTION).doc(key).set(
    { count: FieldValue.increment(1), org_id: orgId, type: "llm_success", hour: getHourKey() },
    { merge: true }
  );
}

export async function isOrgCircuitOpen(orgId: string): Promise<boolean> {
  const doc = await db.collection(COLLECTION).doc(`${orgId}_blocked`).get();
  if (!doc.exists) return false;
  const data = doc.data();
  const until = data?.blocked_until;
  if (!until) return false;
  const untilMs = until.toMillis?.() ?? new Date(until).getTime();
  if (Date.now() < untilMs) return true;
  await doc.ref.delete();
  return false;
}

async function openCircuit(orgId: string): Promise<void> {
  const until = new Date(Date.now() + COOLDOWN_MS);
  await db.collection(COLLECTION).doc(`${orgId}_blocked`).set({
    org_id: orgId,
    blocked_until: until,
    reason: "rate_limit_or_error_threshold",
    createdAt: FieldValue.serverTimestamp(),
  });
  writeAuditLog({
    event: "manual_override",
    org_id: orgId,
    details: { action: "circuit_breaker_open", cooldown_minutes: 10 },
  }).catch(() => {});
  log.warn("Org circuit breaker opened", { org_id: orgId, cooldown_minutes: 10 });
}

export async function checkAndMaybeOpenCircuit(orgId: string): Promise<void> {
  const hour = getHourKey();
  const [rateDoc, errorDoc, successDoc] = await Promise.all([
    db.collection(COLLECTION).doc(`${orgId}_rate_${hour}`).get(),
    db.collection(COLLECTION).doc(`${orgId}_error_${hour}`).get(),
    db.collection(COLLECTION).doc(`${orgId}_success_${hour}`).get(),
  ]);
  const rateCount = Number(rateDoc.data()?.count ?? 0);
  const errorCount = Number(errorDoc.data()?.count ?? 0);
  const successCount = Number(successDoc.data()?.count ?? 0);
  const total = errorCount + successCount;
  const errorRatio = total >= MIN_REQUESTS_FOR_ERROR_RATIO ? errorCount / total : 0;
  if (rateCount >= RATE_LIMIT_THRESHOLD || errorRatio >= ERROR_RATIO_THRESHOLD) {
    await openCircuit(orgId);
  }
}
