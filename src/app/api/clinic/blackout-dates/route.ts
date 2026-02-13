/**
 * Enterprise: Blackout Dates API — วันปิด (วันหยุด, ซ่อมบำรุง)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, listBlackoutDates, createBlackoutDate } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess, requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const items = await listBlackoutDates(orgId, { branchId: branchId || null, from, to });
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/clinic/blackout-dates:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const date = typeof body.date === "string" ? body.date.trim() : null;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
    }
    const branchId = typeof body.branch_id === "string" ? body.branch_id : undefined;
    if (branchId && !requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;
    const id = await createBlackoutDate(orgId, { branch_id: branchId ?? null, date, reason });
    return NextResponse.json({ id, success: true });
  } catch (err) {
    console.error("POST /api/clinic/blackout-dates:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
