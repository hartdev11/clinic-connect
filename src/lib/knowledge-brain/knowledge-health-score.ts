/**
 * Phase 3 #8 — Knowledge Health Score Per Clinic (0-100)
 */
import { db } from "@/lib/firebase-admin";

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

export interface ClinicKnowledgeHealthMetric {
  org_id: string;
  knowledge_health_score: number;
  average_quality_score: number;
  drift_rate: number;
  hallucination_rate: number;
  approval_rejection_rate: number;
  duplicate_rate: number;
  sample_size: number;
}

export async function computeClinicKnowledgeHealthScore(
  orgId: string,
  windowDays: number = 30
): Promise<ClinicKnowledgeHealthMetric> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const clinicSnap = await db
    .collection("clinic_knowledge")
    .where("org_id", "==", orgId)
    .get();

  interface RawClinicDoc {
    id: string;
    knowledge_quality_score?: unknown;
    status?: unknown;
    duplicate_of?: unknown;
  }
  const items: RawClinicDoc[] = clinicSnap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
  })) as RawClinicDoc[];

  const withScore = items.filter(
    (i): i is RawClinicDoc & { knowledge_quality_score: number } =>
      typeof i.knowledge_quality_score === "number"
  );
  const avgQuality =
    withScore.length > 0
      ? withScore.reduce((a, i) => a + (i.knowledge_quality_score ?? 0), 0) / withScore.length
      : 70;

  const needsReview = items.filter((i) => i.status === "needs_review").length;
  const driftRate = items.length > 0 ? needsReview / items.length : 0;

  const withDuplicate = items.filter((i) => i.duplicate_of).length;
  const duplicateRate = items.length > 0 ? withDuplicate / items.length : 0;

  const logsSnap = await db
    .collection("ai_activity_logs")
    .where("org_id", "==", orgId)
    .where("created_at", ">=", cutoff)
    .limit(500)
    .get();

  let totalWithRetrieval = 0;
  let hallucinationCount = 0;
  for (const doc of logsSnap.docs) {
    const d = doc.data();
    if (d.retrieval_knowledge_ids?.length) totalWithRetrieval++;
    if (d.hallucination_flag || d.hallucination_detected) hallucinationCount++;
  }
  const hallucinationRate = totalWithRetrieval > 0 ? hallucinationCount / totalWithRetrieval : 0;

  const auditSnap = await db
    .collection("audit_logs")
    .where("org_id", "==", orgId)
    .orderBy("timestamp", "desc")
    .limit(300)
    .get();

  let approveCount = 0;
  let rejectCount = 0;
  for (const doc of auditSnap.docs) {
    const data = doc.data();
    const ts = data.timestamp?.toDate?.() ?? new Date(data.timestamp);
    if (ts < cutoff) continue;
    if (data.action === "knowledge_approve") approveCount++;
    else if (data.action === "knowledge_reject") rejectCount++;
  }
  const totalDecisions = approveCount + rejectCount;
  const rejectionRate = totalDecisions > 0 ? rejectCount / totalDecisions : 0;

  const weights = { quality: 0.3, drift: 0.2, hallucination: 0.2, rejection: 0.15, duplicate: 0.15 };
  const raw =
    (avgQuality / 100) * weights.quality +
    (1 - driftRate) * weights.drift +
    (1 - hallucinationRate) * weights.hallucination +
    (1 - rejectionRate) * weights.rejection +
    (1 - duplicateRate) * weights.duplicate;
  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));

  return {
    org_id: orgId,
    knowledge_health_score: score,
    average_quality_score: Math.round(avgQuality),
    drift_rate: Math.round(driftRate * 1000) / 10,
    hallucination_rate: Math.round(hallucinationRate * 1000) / 10,
    approval_rejection_rate: Math.round(rejectionRate * 1000) / 10,
    duplicate_rate: Math.round(duplicateRate * 1000) / 10,
    sample_size: items.length,
  };
}
