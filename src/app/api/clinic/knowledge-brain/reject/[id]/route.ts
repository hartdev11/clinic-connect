/**
 * POST /api/clinic/knowledge-brain/reject/:id — reject (owner/manager)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { requireRole } from "@/lib/rbac";
import { getEffectiveUser } from "@/lib/rbac";
import { getClinicKnowledgeById, updateClinicKnowledge, saveKnowledgeVersionSnapshot, logKnowledgeAudit } from "@/lib/knowledge-brain";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const clinicDoc = await getClinicKnowledgeById(id, orgId);
    if (!clinicDoc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const reason = body.reason as string | undefined;

    await updateClinicKnowledge(id, orgId, { status: "draft" }, session.user_id);
    const updated = await getClinicKnowledgeById(id, orgId);
    if (updated) {
      await saveKnowledgeVersionSnapshot(id, orgId, updated.version, updated as unknown as Record<string, unknown>, session.user_id);
    }

    void logKnowledgeAudit({
      org_id: orgId,
      action: "knowledge_reject",
      user_id: session.user_id,
      target_id: id,
      target_type: "clinic_knowledge",
      details: { reason: reason?.slice(0, 200) },
    });

    return NextResponse.json({ ok: true, status: "draft" });
  } catch (err) {
    console.error("POST /api/clinic/knowledge-brain/reject/[id]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
