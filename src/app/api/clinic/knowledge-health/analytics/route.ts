import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser } from "@/lib/rbac";
import { canAccessKnowledgeAction } from "@/lib/knowledge-permissions";
import { computeKnowledgeOrgAnalytics } from "@/lib/knowledge-analytics";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/knowledge-health/analytics", request, async () => {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const user = await getEffectiveUser(session);
    if (!canAccessKnowledgeAction("read", session, user.role)) {
      return NextResponse.json({ error: "Forbidden", code: "INSUFFICIENT_ROLE" }, { status: 403 });
    }

    try {
      const analytics = await computeKnowledgeOrgAnalytics(orgId);
      return NextResponse.json(analytics);
    } catch (err) {
      console.error("GET /api/clinic/knowledge-health/analytics:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
