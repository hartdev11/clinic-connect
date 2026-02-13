/**
 * Enterprise: Day Timeline API — ปฏิทินแบบ time-slot
 * GET ?date=YYYY-MM-DD&branchId=xxx&doctorId=xxx
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { getDayTimeline } from "@/lib/slot-engine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const branchId = searchParams.get("branchId") ?? session.branch_id ?? null;
    const doctorId = searchParams.get("doctorId") ?? undefined;
    if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!dateStr || !branchId) {
      return NextResponse.json({ error: "date and branchId required" }, { status: 400 });
    }
    const result = await getDayTimeline(orgId, branchId, dateStr, { doctorId });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/clinic/bookings/day-timeline:", err);
    const status = msg.includes("Firebase") || msg.includes("permission") ? 503 : 500;
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? msg : "Server error" },
      { status }
    );
  }
}
