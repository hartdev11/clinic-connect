/**
 * Enterprise: Branch Hours API — เวลาเปิด–ปิดของสาขา
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getBranchHours, upsertBranchHours } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess, requireRole } from "@/lib/rbac";
import type { DayOfWeek, DayHours } from "@/types/clinic";

export const dynamic = "force-dynamic";

const DAY_KEYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id: branchId } = await params;
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const hours = await getBranchHours(orgId, branchId);
    if (!hours) {
      return NextResponse.json({
        branchId,
        slot_duration_minutes: 30,
        monday: { open: "09:00", close: "18:00" },
        tuesday: { open: "09:00", close: "18:00" },
        wednesday: { open: "09:00", close: "18:00" },
        thursday: { open: "09:00", close: "18:00" },
        friday: { open: "09:00", close: "18:00" },
        saturday: { open: "09:00", close: "14:00" },
        sunday: null,
      });
    }
    return NextResponse.json(hours);
  } catch (err) {
    console.error("GET /api/clinic/branches/[id]/hours:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id: branchId } = await params;
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const updates: Partial<Record<DayOfWeek, DayHours | null>> & { slot_duration_minutes?: number } = {};
    for (const day of DAY_KEYS) {
      const val = body[day];
      if (val === null || val === false) updates[day] = null;
      else if (val && typeof val === "object" && "open" in val && "close" in val) {
        updates[day] = { open: String(val.open), close: String(val.close) };
      }
    }
    if (typeof body.slot_duration_minutes === "number" && body.slot_duration_minutes >= 15) {
      updates.slot_duration_minutes = body.slot_duration_minutes;
    }
    await upsertBranchHours(orgId, branchId, updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/clinic/branches/[id]/hours:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
