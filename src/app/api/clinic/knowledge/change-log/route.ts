/**
 * Knowledge Change Log API — list recent changes (Created / Updated / Rolled back / Deleted)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { listKnowledgeChangeLog } from "@/lib/knowledge-topics-data";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

async function getAuth(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return { error: NextResponse.json({ error: "Organization not found" }, { status: 404 }) };
  const user = await getEffectiveUser(session);
  if (!requireRole(user.role, ["owner", "manager", "staff"])) {
    return { error: NextResponse.json({ error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึงข้อมูล Knowledge" }, { status: 403 }) };
  }
  return { orgId, user };
}

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/knowledge/change-log", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;

    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10) || 50,
      100
    );

    try {
      const entries = await listKnowledgeChangeLog(auth.orgId, { limit });
      return {
        response: NextResponse.json({ entries }),
        orgId: auth.orgId,
      };
    } catch (err) {
      console.error("GET /api/clinic/knowledge/change-log:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
