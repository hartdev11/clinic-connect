import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser } from "@/lib/rbac";
import { canAccessKnowledgeAction } from "@/lib/knowledge-permissions";
import { db } from "@/lib/firebase-admin";
import { computeClinicKnowledgeHealthScore } from "@/lib/knowledge-brain";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/knowledge-health", request, async () => {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const user = await getEffectiveUser(session);
    if (!canAccessKnowledgeAction("read", session, user.role)) {
      return NextResponse.json(
        { error: "Forbidden", code: "INSUFFICIENT_ROLE" },
        { status: 403 }
      );
    }

    try {
      const clinicSnap = await db.collection("clinic_knowledge").where("org_id", "==", orgId).get();

      let lowQualityCount = 0;
      let duplicateCount = 0;
      let needsReviewCount = 0;
      let expiringCount = 0;
      let highFailureCount = 0;

      const expiringAlerts: Array<{ org_id: string; id: string; base_service_id: string; updated_at: string }> = [];

      for (const doc of clinicSnap.docs) {
        const d = doc.data();
        const score = typeof d.knowledge_quality_score === "number" ? d.knowledge_quality_score : 0;
        const status = d.status ?? "draft";
        const duplicateOf = d.duplicate_of ?? null;
        const failureCount = typeof d.failure_count === "number" ? d.failure_count : 0;
        const lastReviewed = d.last_reviewed_at ? toISO(d.last_reviewed_at) : null;
        const updatedAt = toISO(d.updated_at);
        const expiryDays = typeof d.expiry_policy_days === "number" ? d.expiry_policy_days : 180;
        const refDate = lastReviewed ? new Date(lastReviewed) : new Date(updatedAt);
        const daysSinceReview = (Date.now() - refDate.getTime()) / (24 * 60 * 60 * 1000);
        const isExpiring = daysSinceReview >= expiryDays * 0.9;

        if (score > 0 && score < 70) lowQualityCount++;
        if (duplicateOf) duplicateCount++;
        if (status === "needs_review") needsReviewCount++;
        if (isExpiring && status === "approved") expiringCount++;
        if (failureCount >= 3) highFailureCount++;

        if (status === "approved" && lastReviewed) {
          const ageDays = (Date.now() - new Date(lastReviewed).getTime()) / (24 * 60 * 60 * 1000);
          if (ageDays >= 150) {
            expiringAlerts.push({
              org_id: orgId,
              id: doc.id,
              base_service_id: d.base_service_id ?? "",
              updated_at: updatedAt,
            });
          }
        }
      }

      const logsSnap = await db.collection("ai_activity_logs").orderBy("created_at", "desc").limit(1000).get();

      let lowConfidenceRate = 0;
      let totalWithConfidence = 0;
      let relevanceSum = 0;
      let relevanceCount = 0;

      for (const doc of logsSnap.docs) {
        const d = doc.data();
        const logOrgId = typeof d.org_id === "string" ? d.org_id : null;
        if (logOrgId && logOrgId !== orgId) continue;

        const confidence = d.retrieval_confidence;
        if (typeof confidence === "number") {
          totalWithConfidence++;
          if (confidence < 0.75) lowConfidenceRate++;
          relevanceSum += confidence;
          relevanceCount++;
        }
      }

      const lowConfidenceRatePct = totalWithConfidence > 0 ? (lowConfidenceRate / totalWithConfidence) * 100 : 0;
      const avgRelevanceScore = relevanceCount > 0 ? relevanceSum / relevanceCount : 0;

      const policySnap = await db
        .collection("ai_activity_logs")
        .where("org_id", "==", orgId)
        .where("policy_violation_detected", "==", true)
        .limit(100)
        .get();

      const healthScore = await computeClinicKnowledgeHealthScore(orgId);
      const knowledgeGaps: Array<{ query: string; count: number; date: string }> = [];
      for (const date of getLast7Days()) {
        const gapsSnap = await db
          .collection("organizations")
          .doc(orgId)
          .collection("metrics")
          .doc(date)
          .collection("knowledge_gaps")
          .get();
        for (const gap of gapsSnap.docs) {
          const data = gap.data();
          knowledgeGaps.push({
            query: String(data.query ?? ""),
            count: Number(data.count ?? 1),
            date,
          });
        }
      }
      knowledgeGaps.sort((a, b) => b.count - a.count);

      return {
        response: NextResponse.json({
          knowledge_health_score: healthScore?.knowledge_health_score ?? null,
          health_metric: healthScore,
          top_low_quality_clinics: [{ org_id: orgId, count: lowQualityCount }],
          most_duplicated_services: [{ org_id: orgId, count: duplicateCount }],
          expiring_knowledge_alerts: expiringAlerts.slice(0, 20),
          policy_violation_summary: { recent_count: policySnap.size },
          low_confidence_rate_pct: Math.round(lowConfidenceRatePct * 10) / 10,
          by_org: {
            [orgId]: {
              org_id: orgId,
              low_quality_count: lowQualityCount,
              duplicate_count: duplicateCount,
              needs_review_count: needsReviewCount,
              expiring_count: expiringCount,
              high_failure_count: highFailureCount,
            },
          },
          knowledge_gaps: knowledgeGaps.slice(0, 50),
          rag_quality: {
            avg_relevance_score: Math.round(avgRelevanceScore * 100) / 100,
            low_score_warning: lowConfidenceRatePct > 20,
          },
        }),
        orgId,
      };
    } catch (error) {
      console.error("GET /api/clinic/knowledge-health:", error);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(error) : "Server error" },
        { status: 500 }
      );
    }
  });
}
