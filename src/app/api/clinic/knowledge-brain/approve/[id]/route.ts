/**
 * POST /api/clinic/knowledge-brain/approve/:id — approve (owner/manager)
 * Phase 2: Quality score >= 70, policy compliance required
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
  logKnowledgeAudit,
  buildStructuredContext,
  upsertClinicKnowledgeToVector,
  computeKnowledgeQualityScore,
  MIN_APPROVE_SCORE,
  checkPolicyCompliance,
} from "@/lib/knowledge-brain";
import { invalidateAICache } from "@/lib/ai/ai-feedback-loop";

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
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json({ error: "Forbidden: Only owner/manager can approve" }, { status: 403 });
    }

    const { id } = await params;
    const clinicDoc = await getClinicKnowledgeById(id, orgId);
    if (!clinicDoc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (clinicDoc.status !== "pending_review") {
      return NextResponse.json(
        { error: `Cannot approve: status is ${clinicDoc.status}` },
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
          error: `Quality score ${quality.score} below minimum ${MIN_APPROVE_SCORE}. Cannot approve.`,
          quality_score: quality.score,
          grade: quality.grade,
          warnings: quality.warnings,
        },
        { status: 400 }
      );
    }

    const content = [
      globalDoc.description,
      clinicDoc.custom_brand,
      clinicDoc.custom_differentiator,
      clinicDoc.custom_notes,
    ]
      .filter(Boolean)
      .join(" ");
    const policy = await checkPolicyCompliance(content, clinicDoc.base_service_id);
    if (!policy.passed) {
      return NextResponse.json(
        { error: "Policy compliance failed", violations: policy.violations },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    await updateClinicKnowledge(
      id,
      orgId,
      { status: "approved", last_reviewed_at: now },
      session.user_id
    );
    const updated = await getClinicKnowledgeById(id, orgId);
    if (updated && globalDoc) {
      const ctx = buildStructuredContext(globalDoc, updated);
      await upsertClinicKnowledgeToVector(orgId, updated, globalDoc, ctx);
    }

    void logKnowledgeAudit({
      org_id: orgId,
      action: "knowledge_approve",
      user_id: session.user_id,
      target_id: id,
      target_type: "clinic_knowledge",
    });
    void invalidateAICache({ org_id: orgId, scope: "knowledge" });

    return NextResponse.json({ ok: true, status: "approved" });
  } catch (err) {
    console.error("POST /api/clinic/knowledge-brain/approve/[id]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
