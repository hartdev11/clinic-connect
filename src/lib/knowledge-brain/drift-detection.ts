/**
 * Enterprise Knowledge Brain — Drift Detection & Monitoring
 * Phase 2 #15: last_reviewed_at, expiry_policy_days, needs_review, drift analysis
 */
import { db } from "@/lib/firebase-admin";

const COL_CLINIC = "clinic_knowledge";
const COL_GLOBAL = "global_knowledge";
const DEFAULT_EXPIRY_DAYS = 180; // 6 months
const STALE_MONTHS = 6;

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

export interface DriftAnalysisItem {
  id: string;
  org_id: string;
  base_service_id: string;
  status: string;
  last_reviewed_at: string | null;
  updated_at: string;
  expiry_days: number;
  is_expired: boolean;
  reason: string;
}

export interface DriftDetectionResult {
  needsReviewCount: number;
  items: DriftAnalysisItem[];
  promotions_expired: number;
  machine_deprecated: number;
}

/**
 * Background: เปลี่ยน status = needs_review เมื่อเกิน expiry_policy_days
 */
export async function runDriftExpiryJob(): Promise<{ updated: number }> {
  const now = new Date();
  const snap = await db.collection(COL_CLINIC).get();
  let updated = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const status = d.status as string;
    if (status === "needs_review" || status === "draft") continue;

    const lastReviewed = d.last_reviewed_at;
    const expiryDays = typeof d.expiry_policy_days === "number" ? d.expiry_policy_days : DEFAULT_EXPIRY_DAYS;
    const refDate = lastReviewed ? (lastReviewed.toDate?.() ?? new Date(toISO(lastReviewed))) : new Date(toISO(d.updated_at));
    const diffMs = now.getTime() - refDate.getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);

    if (diffDays >= expiryDays) {
      await doc.ref.update({
        status: "needs_review",
        updated_at: now.toISOString(),
      });
      updated++;
    }
  }

  return { updated };
}

/**
 * วิเคราะห์ drift — ข้อมูลเก่าเกิน 6 เดือน, promotion expiry, machine deprecation
 */
export async function runDriftAnalysis(orgId?: string | null): Promise<DriftDetectionResult> {
  const q = orgId
    ? db.collection(COL_CLINIC).where("org_id", "==", orgId)
    : db.collection(COL_CLINIC);
  const snap = await q.get();

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - STALE_MONTHS);
  const cutoffStr = cutoff.toISOString();

  const items: DriftAnalysisItem[] = [];
  let promotions_expired = 0;
  let machine_deprecated = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const org_id = d.org_id ?? "";
    const base_service_id = d.base_service_id ?? "";
    const status = d.status ?? "draft";
    const lastReviewed = d.last_reviewed_at;
    const updated_at = toISO(d.updated_at);
    const expiryDays = typeof d.expiry_policy_days === "number" ? d.expiry_policy_days : DEFAULT_EXPIRY_DAYS;

    const refDate = lastReviewed ? (lastReviewed.toDate?.() ?? new Date(toISO(lastReviewed))) : new Date(updated_at);
    const diffMs = Date.now() - refDate.getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    const is_expired = diffDays >= expiryDays;

    let reason = "";
    if (updated_at < cutoffStr) reason = "ข้อมูลเก่าเกิน 6 เดือน";
    if (is_expired) reason = reason ? `${reason}; เกินวันหมดอายุ` : "เกินวันหมดอายุ";
    if (d.machine_deprecated) {
      machine_deprecated++;
      reason = reason ? `${reason}; เครื่องเลิกใช้` : "เครื่องเลิกใช้";
    }

    items.push({
      id: doc.id,
      org_id,
      base_service_id,
      status,
      last_reviewed_at: lastReviewed ? toISO(lastReviewed) : null,
      updated_at,
      expiry_days: expiryDays,
      is_expired,
      reason: reason || "ปกติ",
    });
  }

  // Placeholder: promotions_expired มาจาก promotions collection (ต้อง query แยก)
  const promoSnap = orgId
    ? await db.collection("promotions").where("org_id", "==", orgId).where("expires_at", "<", new Date()).get()
    : { empty: true, docs: [] };
  promotions_expired = promoSnap.empty ? 0 : promoSnap.docs.length;

  return {
    needsReviewCount: items.filter((i) => i.is_expired || i.status === "needs_review").length,
    items,
    promotions_expired,
    machine_deprecated,
  };
}
