import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { getAvailableSlots } from "@/lib/slot-engine";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

/** GET /api/clinic/bookings/slots?branchId=xxx&date=YYYY-MM-DD&doctorId=xxx (optional) */
export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/bookings/slots", request, async () => {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") ?? session.branch_id ?? null;
    const dateStr = searchParams.get("date");
    if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!branchId || !dateStr) {
      return NextResponse.json({ error: "branchId and date required" }, { status: 400 });
    }
    const doctorId = searchParams.get("doctorId") || undefined;
    const procedure = searchParams.get("procedure") || undefined;
    const duration = Number(searchParams.get("duration")) || 30;
    const result = await getAvailableSlots(orgId, branchId, dateStr, {
      doctorId,
      procedure,
      durationMinutes: duration,
    });
    return { response: NextResponse.json(result), orgId, branchId };
  } catch (err) {
    console.error("GET /api/clinic/bookings/slots:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}
