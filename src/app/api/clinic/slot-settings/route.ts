/**
 * Enterprise: Slot Settings API
 * POST — ตรวจสอบและสร้าง branch_hours สำหรับสาขาที่ยังไม่มี (idempotent)
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, ensureBranchHoursForOrg } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const created = await ensureBranchHoursForOrg(orgId);
    return NextResponse.json({ success: true, created });
  } catch (err) {
    console.error("POST /api/clinic/slot-settings:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
