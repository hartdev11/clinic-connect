/**
 * GET /api/admin/knowledge-health — Phase 2 #19
 * Knowledge Health Dashboard metrics
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { db } from "@/lib/firebase-admin";
import { computeClinicKnowledgeHealthScore } from "@/lib/knowledge-brain";

export const dynamic = "force-dynamic";

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;
  const defaultOrgId = guard.session.org_id;

  try {
    const orgId = request.nextUrl.searchParams.get("org_id") || defaultOrgId;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    const cutoffStr = cutoff.toISOString();

    let clinicQ = db.collection("clinic_knowledge");
    if (orgId) clinicQ = clinicQ.where("org_id", "==", orgId) as typeof clinicQ;
    const clinicSnap = await clinicQ.get();

    const byOrg = new Map<
      string,
      {
        org_id: string;
        low_quality_count: number;
        duplicate_count: number;
        needs_review_count: number;
        expiring_count: number;
        high_failure_count: number;
        items: Array<{
          id: string;
          base_service_id: string;
          quality_score: number;
          status: string;
          duplicate_of: string | null;
          failure_count: number;
          last_reviewed_at: string | null;
          updated_at: string;
        }>;
      }
    >();

    for (const doc of clinicSnap.docs) {
      const d = doc.data();
      const oid = d.org_id ?? "";
      const score = typeof d.knowledge_quality_score === "number" ? d.knowledge_quality_score : 0;
      const status = d.status ?? "draft";
      const dupOf = d.duplicate_of ?? null;
      const failureCount = typeof d.failure_count === "number" ? d.failure_count : 0;
      const lastReviewed = d.last_reviewed_at ? toISO(d.last_reviewed_at) : null;
      const updatedAt = toISO(d.updated_at);
      const expiryDays = typeof d.expiry_policy_days === "number" ? d.expiry_policy_days : 180;
      const refDate = lastReviewed ? new Date(lastReviewed) : new Date(updatedAt);
      const daysSinceReview = (Date.now() - refDate.getTime()) / (24 * 60 * 60 * 1000);
      const isExpiring = daysSinceReview >= expiryDays * 0.9;

      if (!byOrg.has(oid)) {
        byOrg.set(oid, {
          org_id: oid,
          low_quality_count: 0,
          duplicate_count: 0,
          needs_review_count: 0,
          expiring_count: 0,
          high_failure_count: 0,
          items: [],
        });
      }
      const bucket = byOrg.get(oid)!;
      if (score > 0 && score < 70) bucket.low_quality_count++;
      if (dupOf) bucket.duplicate_count++;
      if (status === "needs_review") bucket.needs_review_count++;
      if (isExpiring && status === "approved") bucket.expiring_count++;
      if (failureCount >= 3) bucket.high_failure_count++;
      bucket.items.push({
        id: doc.id,
        base_service_id: d.base_service_id ?? "",
        quality_score: score,
        status,
        duplicate_of: dupOf,
        failure_count: failureCount,
        last_reviewed_at: lastReviewed,
        updated_at: updatedAt,
      });
    }

    const topLowQuality = [...byOrg.entries()]
      .map(([oid, v]) => ({ org_id: oid, count: v.low_quality_count }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topDuplicated = [...byOrg.entries()]
      .map(([oid, v]) => ({ org_id: oid, count: v.duplicate_count }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const expiringAlerts: Array<{ org_id: string; id: string; base_service_id: string; updated_at: string }> = [];
    for (const [oid, v] of byOrg.entries()) {
      for (const it of v.items) {
        if (it.status === "approved" && it.last_reviewed_at) {
          const days = (Date.now() - new Date(it.last_reviewed_at).getTime()) / (24 * 60 * 60 * 1000);
          if (days >= 150) {
            expiringAlerts.push({
              org_id: oid,
              id: it.id,
              base_service_id: it.base_service_id,
              updated_at: it.updated_at,
            });
          }
        }
      }
    }

    const logsSnap = await db
      .collection("ai_activity_logs")
      .orderBy("created_at", "desc")
      .limit(1000)
      .get();

    let lowConfidenceRate = 0;
    let totalWithConfidence = 0;
    for (const doc of logsSnap.docs) {
      const r = doc.data().retrieval_confidence;
      if (typeof r === "number") {
        totalWithConfidence++;
        if (r < 0.75) lowConfidenceRate++;
      }
    }
    const lowConfidenceRatePct = totalWithConfidence > 0 ? (lowConfidenceRate / totalWithConfidence) * 100 : 0;

    const policySnap = await db
      .collection("ai_activity_logs")
      .where("policy_violation_detected", "==", true)
      .limit(100)
      .get();

    const healthScore = orgId ? await computeClinicKnowledgeHealthScore(orgId) : null;

    return NextResponse.json({
      knowledge_health_score: healthScore?.knowledge_health_score ?? null,
      health_metric: healthScore,
      top_low_quality_clinics: topLowQuality,
      most_duplicated_services: topDuplicated,
      expiring_knowledge_alerts: expiringAlerts.slice(0, 20),
      policy_violation_summary: {
        recent_count: policySnap.size,
      },
      low_confidence_rate_pct: Math.round(lowConfidenceRatePct * 10) / 10,
      by_org: orgId ? byOrg.get(orgId) ?? null : Object.fromEntries(byOrg),
    });
  } catch (err) {
    console.error("GET /api/admin/knowledge-health:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
