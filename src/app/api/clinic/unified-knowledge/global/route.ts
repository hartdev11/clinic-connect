/**
 * GET /api/clinic/unified-knowledge/global
 * List global services (platform templates, read-only)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { listGlobalServices } from "@/lib/unified-knowledge/data";
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
  return { orgId, user };
}

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/unified-knowledge/global", request, async () => {
    const auth = await getAuth(request);
    if ("error" in auth) return auth.error;

    try {
      const items = await listGlobalServices(200);
      return NextResponse.json({ items });
    } catch (err) {
      console.error("GET /api/clinic/unified-knowledge/global:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
