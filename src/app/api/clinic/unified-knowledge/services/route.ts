/**
 * GET /api/clinic/unified-knowledge/services — list
 * POST /api/clinic/unified-knowledge/services — create + enqueue embed
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getOrgProfile } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { isPlatformManagedMode } from "@/lib/feature-flags";
import { listClinicServices, createClinicService } from "@/lib/unified-knowledge/data";
import { logUnifiedKnowledgeAudit } from "@/lib/unified-knowledge/audit";
import { enqueueUnifiedServiceEmbed } from "@/lib/knowledge-brain/embedding-queue";
import type { ClinicServiceCreate } from "@/types/unified-knowledge";

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

function parseBody(body: unknown, defaultClinicId: string): ClinicServiceCreate | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const clinic_id = typeof b.clinic_id === "string" ? b.clinic_id.trim() || defaultClinicId : defaultClinicId;
  const custom_title = (typeof b.custom_title === "string" ? b.custom_title.trim() : "").slice(0, MAX_TITLE);
  const global_service_id = typeof b.global_service_id === "string" ? b.global_service_id.trim() || null : null;
  const custom_highlight = (typeof b.custom_highlight === "string" ? b.custom_highlight.trim() : "").slice(0, MAX_HIGHLIGHT);
  const custom_price = (typeof b.custom_price === "string" ? b.custom_price.trim() : "").slice(0, MAX_PRICE);
  const custom_description = (typeof b.custom_description === "string" ? b.custom_description.trim() : "").slice(0, MAX_DESCRIPTION);
  const status = b.status === "inactive" ? "inactive" : "active";
  if (!custom_title) return null;
  return {
    clinic_id,
    global_service_id: global_service_id ?? null,
    custom_title,
    custom_highlight,
    custom_price,
    custom_description,
    status,
  };
}

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/unified-knowledge/services", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;

    try {
      const list = await listClinicServices(auth.orgId, { limit: 100 });
      return NextResponse.json({ items: list });
    } catch (err) {
      console.error("GET /api/clinic/unified-knowledge/services:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return runWithObservability("/api/clinic/unified-knowledge/services", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const data = parseBody(body, auth.orgId);
    if (!data) return NextResponse.json({ error: "custom_title required" }, { status: 400 });
    if (data.clinic_id !== auth.orgId) {
      return NextResponse.json({ error: "clinic_id must match your organization" }, { status: 403 });
    }
    const orgProfile = await getOrgProfile(auth.orgId);
    if (isPlatformManagedMode(orgProfile?.plan) && !data.global_service_id) {
      return NextResponse.json(
        { error: "โหมดจัดการโดยแพลตฟอร์ม: ต้องเลือกเทมเพลตจากแพลตฟอร์ม" },
        { status: 403 }
      );
    }

    try {
      const id = await createClinicService(data, auth.userId);
      await enqueueUnifiedServiceEmbed(auth.orgId, id);
      await logUnifiedKnowledgeAudit({
        org_id: auth.orgId,
        action: "unified_service_create",
        user_id: auth.userId || null,
        target_id: id,
        target_type: "clinic_service",
        details: { custom_title: data.custom_title },
      });
      return NextResponse.json({ id, success: true });
    } catch (err) {
      console.error("POST /api/clinic/unified-knowledge/services:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
