/**
 * GET /api/clinic/knowledge-brain/clinic — list
 * POST /api/clinic/knowledge-brain/clinic — create
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { requireRole } from "@/lib/rbac";
import { getEffectiveUser } from "@/lib/rbac";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import {
  listClinicKnowledge,
  createClinicKnowledge,
  getClinicKnowledgeById,
  updateClinicKnowledge,
  getGlobalKnowledgeById,
  validateClinicKnowledgeCreate,
  saveKnowledgeVersionSnapshot,
  logKnowledgeAudit,
  buildStructuredContext,
  checkSemanticDuplicate,
  computeKnowledgeQualityScore,
} from "@/lib/knowledge-brain";
import { invalidateAICache } from "@/lib/ai/ai-feedback-loop";

export const dynamic = "force-dynamic";
const RATE_LIMIT = { windowSeconds: 60, max: 30 };

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager", "staff"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const status = request.nextUrl.searchParams.get("status") as "draft" | "pending_review" | "approved" | "needs_review" | null;
    const items = await listClinicKnowledge(orgId, { status: status ?? undefined, limit: 100 });
    const globalIds = [...new Set(items.map((i) => i.base_service_id))];
    const globals = await Promise.all(globalIds.map((id) => getGlobalKnowledgeById(id)));
    const globalMap = Object.fromEntries(globals.filter(Boolean).map((g) => [g!.id, g!]));
    const enriched = items.map((c) => ({
      ...c,
      global: globalMap[c.base_service_id] ?? null,
    }));
    return NextResponse.json({ items: enriched });
  } catch (err) {
    console.error("GET /api/clinic/knowledge-brain/clinic:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager", "staff"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rate = await checkDistributedRateLimit(`kb_create:${orgId}`, RATE_LIMIT.max, RATE_LIMIT.windowSeconds);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const { rejectClientSentOrgId } = await import("@/lib/org-isolation");
    rejectClientSentOrgId(body);
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const data = {
      org_id: orgId,
      base_service_id: str(body.base_service_id) || "",
      custom_brand: str(body.custom_brand) || null,
      custom_price_range: str(body.custom_price_range) || null,
      custom_differentiator: str(body.custom_differentiator) || null,
      custom_notes: str(body.custom_notes) || null,
      branch_specific: str(body.branch_specific) || null,
      status: (typeof body.status === "string" &&
        ["draft", "pending_review", "approved", "needs_review"].includes(body.status)
        ? body.status
        : "draft") as import("@/types/knowledge-brain").ClinicKnowledgeStatus,
      expiry_policy_days: typeof body.expiry_policy_days === "number" ? body.expiry_policy_days : 180,
      disclaimer: str(body.disclaimer) || null,
    };

    const globalDoc = await getGlobalKnowledgeById(data.base_service_id);
    const validation = validateClinicKnowledgeCreate(data, globalDoc);
    if (!validation.valid) {
      return NextResponse.json({ error: "Validation failed", errors: validation.errors }, { status: 400 });
    }

    // Phase 2 #14: Semantic duplicate check ก่อน create
    const virtualClinic = {
      id: "",
      org_id: orgId,
      base_service_id: data.base_service_id,
      custom_brand: data.custom_brand,
      custom_price_range: data.custom_price_range,
      custom_differentiator: data.custom_differentiator,
      custom_notes: data.custom_notes,
      status: "draft" as const,
      version: 1,
      updated_at: new Date().toISOString(),
    };
    const ctx = buildStructuredContext(globalDoc!, virtualClinic);
    const dupCheck = await checkSemanticDuplicate(orgId, ctx);

    const id = await createClinicKnowledge(data, session.user_id);
    const snapshot = {
      id,
      org_id: orgId,
      base_service_id: data.base_service_id,
      custom_brand: data.custom_brand,
      custom_price_range: data.custom_price_range,
      custom_differentiator: data.custom_differentiator,
      custom_notes: data.custom_notes,
      branch_specific: data.branch_specific,
      status: data.status ?? "draft",
      version: 1,
      updated_at: new Date().toISOString(),
      updated_by: session.user_id,
    };
    await saveKnowledgeVersionSnapshot(id, orgId, 1, snapshot, session.user_id);

    // Phase 2 #13: Compute & store quality score after create
    const created = await getClinicKnowledgeById(id, orgId);
    if (created && globalDoc) {
      const qualityCtx = buildStructuredContext(globalDoc, created);
      const quality = computeKnowledgeQualityScore(globalDoc, created, qualityCtx, {
        similarityScore: dupCheck.similarity_score ?? undefined,
      });
      await updateClinicKnowledge(
        id,
        orgId,
        {
          knowledge_quality_score: quality.score,
          knowledge_quality_grade: quality.grade,
          duplicate_of: dupCheck.duplicate_of,
          similarity_score: dupCheck.similarity_score,
        },
        session.user_id
      );
    }

    void logKnowledgeAudit({
      org_id: orgId,
      action: "knowledge_create",
      user_id: session.user_id,
      target_id: id,
      target_type: "clinic_knowledge",
      details: { base_service_id: data.base_service_id },
    });
    void invalidateAICache({ org_id: orgId, scope: "knowledge" });

    const warnings: string[] = [];
    if (dupCheck.isDuplicate) warnings.push("Potential Duplicate");
    return NextResponse.json({
      id,
      status: "draft",
      potential_duplicate: dupCheck.isDuplicate,
      duplicate_of: dupCheck.duplicate_of,
      similarity_score: dupCheck.similarity_score,
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (err) {
    console.error("POST /api/clinic/knowledge-brain/clinic:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
