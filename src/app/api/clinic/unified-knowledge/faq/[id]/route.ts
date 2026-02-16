/**
 * PATCH /api/clinic/unified-knowledge/faq/[id] — update + enqueue embed
 * DELETE /api/clinic/unified-knowledge/faq/[id] — delete
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { getClinicFaqById, updateClinicFaq, softDeleteClinicFaq } from "@/lib/unified-knowledge/data";
import { logUnifiedKnowledgeAudit } from "@/lib/unified-knowledge/audit";
import { enqueueUnifiedFaqEmbed } from "@/lib/knowledge-brain/embedding-queue";
import { deleteUnifiedFaqFromVector } from "@/lib/unified-knowledge/vector";
import type { ClinicFaqUpdate } from "@/types/unified-knowledge";

const MAX_QUESTION = 500;
const MAX_ANSWER = 2000;
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

async function getAuth(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return { error: NextResponse.json({ error: "Organization not found" }, { status: 404 }) };
  const user = await getEffectiveUser(session);
  if (!requireRole(user.role, ["owner", "manager", "staff"])) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { orgId, userId: session.user_id ?? "", user };
}

function parseBody(body: unknown): ClinicFaqUpdate | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const update: ClinicFaqUpdate = {};
  if (typeof b.question === "string") update.question = b.question.trim().slice(0, MAX_QUESTION);
  if (typeof b.answer === "string") update.answer = b.answer.trim().slice(0, MAX_ANSWER);
  return Object.keys(update).length ? update : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return runWithObservability("/api/clinic/unified-knowledge/faq/[id]", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const data = parseBody(body);
    if (!data) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

    try {
      const ok = await updateClinicFaq(auth.orgId, id, data, auth.userId);
      if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await enqueueUnifiedFaqEmbed(auth.orgId, id);
      await logUnifiedKnowledgeAudit({
        org_id: auth.orgId,
        action: "unified_faq_update",
        user_id: auth.userId || null,
        target_id: id,
        target_type: "clinic_faq",
        details: Object.keys(data),
      });
      const updated = await getClinicFaqById(auth.orgId, id);
      return NextResponse.json(updated ?? { id, success: true });
    } catch (err) {
      console.error("PATCH /api/clinic/unified-knowledge/faq/[id]:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return runWithObservability("/api/clinic/unified-knowledge/faq/[id]", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    try {
      const ok = await softDeleteClinicFaq(auth.orgId, id);
      if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await deleteUnifiedFaqFromVector(auth.orgId, id);
      await logUnifiedKnowledgeAudit({
        org_id: auth.orgId,
        action: "unified_faq_soft_delete",
        user_id: auth.userId || null,
        target_id: id,
        target_type: "clinic_faq",
      });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/clinic/unified-knowledge/faq/[id]:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
