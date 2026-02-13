/**
 * POST /api/clinic/knowledge-brain/submit/:id — submit for review (draft → pending_review)
 * Phase 2: Block if quality score < 70
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { requireRole } from "@/lib/rbac";
import { getEffectiveUser } from "@/lib/rbac";
import {
  getClinicKnowledgeById,
  updateClinicKnowledge,
  getGlobalKnowledgeById,
  buildStructuredContext,
  computeKnowledgeQualityScore,
  runAIQualityReview,
  MIN_APPROVE_SCORE,
  logKnowledgeAudit,
} from "@/lib/knowledge-brain";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager", "staff"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const clinicDoc = await getClinicKnowledgeById(id, orgId);
    if (!clinicDoc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (clinicDoc.status !== "draft") {
      return NextResponse.json(
        { error: `Cannot submit: status is ${clinicDoc.status}` },
        { status: 400 }
      );
    }

    const globalDoc = await getGlobalKnowledgeById(clinicDoc.base_service_id);
    if (!globalDoc) return NextResponse.json({ error: "Base service not found" }, { status: 404 });

    const ctx = buildStructuredContext(globalDoc, clinicDoc);
    const quality = computeKnowledgeQualityScore(globalDoc, clinicDoc, ctx, {
      similarityScore: clinicDoc.similarity_score ?? undefined,
    });

    if (quality.score < MIN_APPROVE_SCORE) {
      return NextResponse.json(
        {
          error: `Quality score ${quality.score} below minimum ${MIN_APPROVE_SCORE}. Cannot submit for review.`,
          quality_score: quality.score,
          grade: quality.grade,
          warnings: quality.warnings,
        },
        { status: 400 }
      );
    }

    // Phase 3 #3: AI quality review on submit
    const aiReview = await runAIQualityReview(globalDoc, clinicDoc);

    await updateClinicKnowledge(
      id,
      orgId,
      {
        status: "pending_review",
        ai_review_score: aiReview.ai_review_score,
        ai_review_notes: aiReview.ai_review_notes,
      },
      session.user_id
    );

    void logKnowledgeAudit({
      org_id: orgId,
      action: "knowledge_update",
      user_id: session.user_id,
      target_id: id,
      target_type: "clinic_knowledge",
      details: { action: "submit_for_review" },
    });

    return NextResponse.json({ ok: true, status: "pending_review" });
  } catch (err) {
    console.error("POST /api/clinic/knowledge-brain/submit/[id]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
