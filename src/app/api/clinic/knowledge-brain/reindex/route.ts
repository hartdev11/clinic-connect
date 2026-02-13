/**
 * POST /api/clinic/knowledge-brain/reindex — trigger re-embed approved clinic knowledge
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { requireRole } from "@/lib/rbac";
import { getEffectiveUser } from "@/lib/rbac";
import {
  listClinicKnowledge,
  getGlobalKnowledgeById,
  buildStructuredContext,
  upsertClinicKnowledgeToVector,
  logKnowledgeAudit,
} from "@/lib/knowledge-brain";
import { invalidateAICache } from "@/lib/ai/ai-feedback-loop";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const approved = await listClinicKnowledge(orgId, { status: "approved", limit: 500 });
    let count = 0;
    for (const c of approved) {
      const globalDoc = await getGlobalKnowledgeById(c.base_service_id);
      if (globalDoc) {
        const ctx = buildStructuredContext(globalDoc, c);
        await upsertClinicKnowledgeToVector(orgId, c, globalDoc, ctx);
        count++;
      }
    }

    void logKnowledgeAudit({
      org_id: orgId,
      action: "knowledge_reindex",
      user_id: session.user_id,
      details: { reindexed_count: count },
    });
    void invalidateAICache({ org_id: orgId, scope: "knowledge" });

    return NextResponse.json({ ok: true, reindexed: count });
  } catch (err) {
    console.error("POST /api/clinic/knowledge-brain/reindex:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
