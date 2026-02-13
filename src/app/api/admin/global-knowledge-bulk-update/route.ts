/**
 * POST /api/admin/global-knowledge-bulk-update — Phase 2 #21
 * Bulk update baseline service, notify clinics using override, require re-approval, re-embed
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { db } from "@/lib/firebase-admin";
import { getGlobalKnowledgeById } from "@/lib/knowledge-brain";
import { enqueueClinicEmbedding } from "@/lib/knowledge-brain/embedding-queue";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const globalId = body.global_id as string | undefined;
    const updates = body.updates as Record<string, unknown> | undefined;

    if (!globalId || !updates || typeof updates !== "object") {
      return NextResponse.json(
        { error: "global_id and updates required" },
        { status: 400 }
      );
    }

    const globalDoc = await getGlobalKnowledgeById(globalId);
    if (!globalDoc) return NextResponse.json({ error: "Global knowledge not found" }, { status: 404 });

    const allowed = ["description", "risks", "contraindications", "disclaimer", "default_FAQ", "procedure_steps"];
    const filtered: Record<string, unknown> = {};
    for (const k of allowed) {
      if (updates[k] !== undefined) filtered[k] = updates[k];
    }
    if (Object.keys(filtered).length === 0) {
      return NextResponse.json({ error: "No valid updates" }, { status: 400 });
    }

    await db.collection("global_knowledge").doc(globalId).update({
      ...filtered,
      version: globalDoc.version + 1,
      last_updated: new Date().toISOString(),
    });

    const clinicSnap = await db
      .collection("clinic_knowledge")
      .where("base_service_id", "==", globalId)
      .get();

    const affectedOrgIds = new Set<string>();
    for (const doc of clinicSnap.docs) {
      const d = doc.data();
      const orgId = d.org_id;
      if (orgId) {
        affectedOrgIds.add(orgId);
        await doc.ref.update({
          status: "needs_review",
          updated_at: new Date().toISOString(),
          last_reviewed_at: null,
        });
        void enqueueClinicEmbedding(orgId, doc.id);
      }
    }

    await db.collection("global_bulk_update_notifications").add({
      global_id: globalId,
      updated_by: guard.session.user_id,
      affected_org_count: affectedOrgIds.size,
      affected_org_ids: [...affectedOrgIds],
      changes: Object.keys(filtered),
      created_at: new Date(),
    });

    return NextResponse.json({
      ok: true,
      global_id: globalId,
      affected_clinics: clinicSnap.size,
      affected_orgs: affectedOrgIds.size,
      message: "Baseline updated. Affected clinic knowledge set to needs_review. Re-embedding queued.",
    });
  } catch (err) {
    console.error("POST /api/admin/global-knowledge-bulk-update:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
