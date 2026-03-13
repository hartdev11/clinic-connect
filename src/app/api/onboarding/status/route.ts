/**
 * GET /api/onboarding/status — Check if org needs onboarding
 * Returns: { needsOnboarding: boolean }
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { hasAiConfig } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  const hasConfig = await hasAiConfig(orgId);
  return NextResponse.json({ needsOnboarding: !hasConfig });
}
