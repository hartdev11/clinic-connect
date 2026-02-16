/**
 * Enterprise: Day Timeline API
 * GET ?date=YYYY-MM-DD&branchId=xxx&doctorId=xxx (optional)
 * คืนค่า slot แบบ time-slot: ว่าง / มีคิว / เสร็จแล้ว
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getBranchesByOrgId } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { getDayTimeline } from "@/lib/slot-engine";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

const CACHE_MAX_AGE = 30;

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/bookings/timeline", request, async () => {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    let branchId = searchParams.get("branchId") ?? session.branch_id ?? null;
    const doctorId = searchParams.get("doctorId") || undefined;

    if (!dateStr) {
      return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
    }

    const branches = await getBranchesByOrgId(orgId);
    branchId = branchId ?? branches[0]?.id ?? null;
    if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!branchId) {
      return NextResponse.json({ error: "branchId required" }, { status: 400 });
    }

    const result = await getDayTimeline(orgId, branchId, dateStr, {
      doctorId,
      durationMinutes: 30,
    });

    const headers = new Headers();
    headers.set("Cache-Control", `private, max-age=${CACHE_MAX_AGE}`);

    return { response: NextResponse.json(result, { headers }), orgId, branchId };
  } catch (err) {
    console.error("GET /api/clinic/bookings/timeline:", err);
    return NextResponse.json(
      {
        error: process.env.NODE_ENV === "development" ? (err as Error).message : "Server error",
        code: "TIMELINE_ERROR",
      },
      { status: 500 }
    );
  }
  });
}
