import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getOrgProfile } from "@/lib/clinic-data";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/me", request, async () => {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    const profile = await getOrgProfile(orgId);
    if (!profile) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }
    return {
      response: NextResponse.json({
        id: profile.id,
        clinicName: profile.clinicName,
        plan: profile.plan,
        branches: profile.branches,
        phone: profile.phone,
        email: profile.email,
        createdAt: profile.createdAt,
      }),
      orgId,
    };
  } catch (err) {
    console.error("GET /api/clinic/me:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}
