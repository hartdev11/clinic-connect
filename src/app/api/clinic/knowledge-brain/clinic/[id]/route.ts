/**
 * PATCH /api/clinic/knowledge-brain/clinic/:id — update
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { requireRole } from "@/lib/rbac";
import { getEffectiveUser } from "@/lib/rbac";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import {
  getClinicKnowledgeById,
  updateClinicKnowledge,
  getGlobalKnowledgeById,
  validateClinicKnowledgeUpdate,
  saveKnowledgeVersionSnapshot,
  logKnowledgeAudit,
  buildStructuredContext,
  computeKnowledgeQualityScore,
} from "@/lib/knowledge-brain";
import { invalidateAICache } from "@/lib/ai/ai-feedback-loop";

export const dynamic = "force-dynamic";
const RATE_LIMIT = { windowSeconds: 60, max: 30 };

export async function PATCH(
  request: NextRequest,
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
    const rate = await checkDistributedRateLimit(`kb_update:${orgId}`, RATE_LIMIT.max, RATE_LIMIT.windowSeconds);
    if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

    const { id } = await params;
    const existing = await getClinicKnowledgeById(id, orgId);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const data = {
      custom_brand: body.custom_brand !== undefined ? (body.custom_brand?.trim() || null) : undefined,
      custom_price_range: body.custom_price_range !== undefined ? (body.custom_price_range?.trim() || null) : undefined,
      custom_differentiator: body.custom_differentiator !== undefined ? (body.custom_differentiator?.trim() || null) : undefined,
      custom_notes: body.custom_notes !== undefined ? (body.custom_notes?.trim() || null) : undefined,
      branch_specific: body.branch_specific !== undefined ? (body.branch_specific?.trim() || null) : undefined,
      status: body.status,
      expiry_policy_days: body.expiry_policy_days,
      disclaimer: body.disclaimer !== undefined ? (body.disclaimer?.trim() || null) : undefined,
    };

    const globalDoc = await getGlobalKnowledgeById(existing.base_service_id);
    const validation = validateClinicKnowledgeUpdate(data, globalDoc);
    if (!validation.valid) {
      return NextResponse.json({ error: "Validation failed", errors: validation.errors }, { status: 400 });
    }

    const merged = { ...existing, ...data } as typeof existing;
    const ctx = buildStructuredContext(globalDoc!, merged);
    const quality = computeKnowledgeQualityScore(globalDoc!, merged, ctx, {
      similarityScore: existing.similarity_score ?? undefined,
    });
    const updateData = {
      ...data,
      knowledge_quality_score: quality.score,
      knowledge_quality_grade: quality.grade,
    };

    const ok = await updateClinicKnowledge(id, orgId, updateData, session.user_id);
    if (!ok) return NextResponse.json({ error: "Update failed" }, { status: 500 });

    const updated = await getClinicKnowledgeById(id, orgId);
    if (updated) {
      await saveKnowledgeVersionSnapshot(id, orgId, updated.version, updated as unknown as Record<string, unknown>, session.user_id);
    }
    void logKnowledgeAudit({
      org_id: orgId,
      action: "knowledge_update",
      user_id: session.user_id,
      target_id: id,
      target_type: "clinic_knowledge",
      details: { fields: Object.keys(data) },
    });
    void invalidateAICache({ org_id: orgId, scope: "knowledge" });

    return NextResponse.json({ ok: true, version: updated?.version });
  } catch (err) {
    console.error("PATCH /api/clinic/knowledge-brain/clinic/[id]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
