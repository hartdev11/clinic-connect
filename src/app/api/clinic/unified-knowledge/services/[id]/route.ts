/**
 * GET /api/clinic/unified-knowledge/services/[id] — get one
 * PATCH /api/clinic/unified-knowledge/services/[id] — update + enqueue embed
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { getClinicServiceById, updateClinicService, softDeleteClinicService } from "@/lib/unified-knowledge/data";
import { deleteUnifiedServiceFromVector } from "@/lib/unified-knowledge/vector";
import { logUnifiedKnowledgeAudit } from "@/lib/unified-knowledge/audit";
import { enqueueUnifiedServiceEmbed } from "@/lib/knowledge-brain/embedding-queue";
import type { ClinicServiceUpdate } from "@/types/unified-knowledge";

const MAX_TITLE = 200;
const MAX_HIGHLIGHT = 500;
const MAX_PRICE = 100;
const MAX_DESCRIPTION = 5000;
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

function parseBody(body: unknown): ClinicServiceUpdate | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const update: ClinicServiceUpdate = {};
  if (typeof b.custom_title === "string") update.custom_title = b.custom_title.trim().slice(0, MAX_TITLE);
  if (typeof b.custom_highlight === "string") update.custom_highlight = b.custom_highlight.trim().slice(0, MAX_HIGHLIGHT);
  if (typeof b.custom_price === "string") update.custom_price = b.custom_price.trim().slice(0, MAX_PRICE);
  if (typeof b.custom_description === "string") update.custom_description = b.custom_description.trim().slice(0, MAX_DESCRIPTION);
  if (b.status === "inactive" || b.status === "active") update.status = b.status;
  return Object.keys(update).length ? update : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return runWithObservability("/api/clinic/unified-knowledge/services/[id]", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    try {
      const item = await getClinicServiceById(auth.orgId, id);
      if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(item);
    } catch (err) {
      console.error("GET /api/clinic/unified-knowledge/services/[id]:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return runWithObservability("/api/clinic/unified-knowledge/services/[id]", request, async () => {
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
      const ok = await updateClinicService(auth.orgId, id, data, auth.userId);
      if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await enqueueUnifiedServiceEmbed(auth.orgId, id);
      await logUnifiedKnowledgeAudit({
        org_id: auth.orgId,
        action: "unified_service_update",
        user_id: auth.userId || null,
        target_id: id,
        target_type: "clinic_service",
        details: Object.keys(data),
      });
      const updated = await getClinicServiceById(auth.orgId, id);
      return NextResponse.json(updated ?? { id, success: true });
    } catch (err) {
      console.error("PATCH /api/clinic/unified-knowledge/services/[id]:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}

/** Soft delete (archive) service — removes from RAG, keeps doc with deleted_at */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return runWithObservability("/api/clinic/unified-knowledge/services/[id]", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    try {
      const ok = await softDeleteClinicService(auth.orgId, id);
      if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await deleteUnifiedServiceFromVector(auth.orgId, id);
      await logUnifiedKnowledgeAudit({
        org_id: auth.orgId,
        action: "unified_service_soft_delete",
        user_id: auth.userId || null,
        target_id: id,
        target_type: "clinic_service",
      });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/clinic/unified-knowledge/services/[id]:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
