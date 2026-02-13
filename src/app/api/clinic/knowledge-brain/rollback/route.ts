/**
 * POST /api/clinic/knowledge-brain/rollback — rollback to version
 * Body: { knowledge_id, version_number }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { requireRole } from "@/lib/rbac";
import { getEffectiveUser } from "@/lib/rbac";
import {
  getClinicKnowledgeById,
  getKnowledgeVersionByNumber,
  logKnowledgeAudit,
} from "@/lib/knowledge-brain";
import { db } from "@/lib/firebase-admin";
import { invalidateAICache } from "@/lib/ai/ai-feedback-loop";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const knowledgeId = body.knowledge_id as string;
    const versionNumber = Number(body.version_number);

    if (!knowledgeId || !versionNumber || versionNumber < 1) {
      return NextResponse.json({ error: "knowledge_id and version_number required" }, { status: 400 });
    }

    const versionSnap = await getKnowledgeVersionByNumber(knowledgeId, orgId, versionNumber);
    if (!versionSnap) return NextResponse.json({ error: "Version not found" }, { status: 404 });

    const snapshot = versionSnap.snapshot as Record<string, unknown>;
    const docRef = db.collection("clinic_knowledge").doc(knowledgeId);
    const doc = await docRef.get();
    if (!doc.exists) return NextResponse.json({ error: "Knowledge not found" }, { status: 404 });
  if (doc.data()?.org_id !== orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await docRef.update({
      custom_brand: snapshot.custom_brand ?? null,
      custom_price_range: snapshot.custom_price_range ?? null,
      custom_differentiator: snapshot.custom_differentiator ?? null,
      custom_notes: snapshot.custom_notes ?? null,
      branch_specific: snapshot.branch_specific ?? null,
      status: snapshot.status ?? "draft",
      version: (snapshot.version as number) ?? versionNumber,
      updated_at: new Date().toISOString(),
      updated_by: session.user_id,
    });

    void logKnowledgeAudit({
      org_id: orgId,
      action: "knowledge_rollback",
      user_id: session.user_id,
      target_id: knowledgeId,
      target_type: "version",
      details: { version_number: versionNumber },
    });
    void invalidateAICache({ org_id: orgId, scope: "knowledge" });

    return NextResponse.json({ ok: true, rolled_back_to: versionNumber });
  } catch (err) {
    console.error("POST /api/clinic/knowledge-brain/rollback:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
