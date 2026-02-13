/**
 * Phase 3 #4 — Knowledge Decay & Drift Prediction
 * Background: hallucination_rate > 5%, low_confidence_rate > 15%, last_reviewed > 180 days → needs_review
 */
import { db } from "@/lib/firebase-admin";

const COL_CLINIC = "clinic_knowledge";
const COL_LOGS = "ai_activity_logs";
const HALLUCINATION_RATE_THRESHOLD = 0.05;
const LOW_CONFIDENCE_RATE_THRESHOLD = 0.15;
const STALE_DAYS = 180;

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

export interface DecayPredictionItem {
  id: string;
  org_id: string;
  base_service_id: string;
  hallucination_rate: number;
  low_confidence_rate: number;
  days_since_review: number;
  needs_review: boolean;
  reasons: string[];
}

export async function runDecayPredictionJob(): Promise<{ marked: number; notified: string[] }> {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);

  const clinicSnap = await db.collection(COL_CLINIC).get();
  let marked = 0;
  const notified: string[] = [];

  for (const doc of clinicSnap.docs) {
    const d = doc.data();
    const orgId = d.org_id ?? "";
    const baseServiceId = d.base_service_id ?? "";

    const lastReviewed = d.last_reviewed_at ? toISO(d.last_reviewed_at) : toISO(d.updated_at);
    const daysSinceReview = Math.floor(
      (now.getTime() - new Date(lastReviewed).getTime()) / (24 * 60 * 60 * 1000)
    );

    const clinicVectorId = `clinic_${doc.id}`;

    const logsSnap = await db
      .collection(COL_LOGS)
      .where("org_id", "==", orgId)
      .where("created_at", ">=", cutoff)
      .limit(500)
      .get();

    let totalWithKnowledge = 0;
    let hallucinationCount = 0;
    let lowConfidenceCount = 0;

    for (const logDoc of logsSnap.docs) {
      const log = logDoc.data();
      const ids = (log.retrieval_knowledge_ids as string[] | undefined) ?? [];
      const used = ids.some(
        (id: string) => id === clinicVectorId || id === doc.id || id.includes(doc.id)
      );
      if (!used && ids.length > 0) continue;
      if (ids.length === 0) continue;

      totalWithKnowledge++;
      if (log.hallucination_flag || log.hallucination_detected) hallucinationCount++;
      const rc = log.retrieval_confidence;
      if (typeof rc === "number" && rc < 0.7) lowConfidenceCount++;
    }

    const hallucinationRate = totalWithKnowledge > 0 ? hallucinationCount / totalWithKnowledge : 0;
    const lowConfidenceRate = totalWithKnowledge > 0 ? lowConfidenceCount / totalWithKnowledge : 0;

    const reasons: string[] = [];
    if (hallucinationRate > HALLUCINATION_RATE_THRESHOLD)
      reasons.push(`hallucination_rate ${(hallucinationRate * 100).toFixed(1)}%`);
    if (lowConfidenceRate > LOW_CONFIDENCE_RATE_THRESHOLD)
      reasons.push(`low_confidence_rate ${(lowConfidenceRate * 100).toFixed(1)}%`);
    if (daysSinceReview > STALE_DAYS) reasons.push(`stale ${daysSinceReview} days`);

    const shouldMark = reasons.length > 0 && (d.status === "approved" || d.status === "draft");

    if (shouldMark) {
      await doc.ref.update({
        status: "needs_review",
        updated_at: now.toISOString(),
      });
      marked++;
      notified.push(`${orgId}:${doc.id}`);
    }
  }

  return { marked, notified };
}
