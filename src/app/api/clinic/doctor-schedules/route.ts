/**
 * Enterprise: Doctor Schedules API — ตารางแพทย์
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, listDoctorSchedules, upsertDoctorSchedule } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import type { DayOfWeek } from "@/types/clinic";

export const dynamic = "force-dynamic";

const DAY_KEYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const items = await listDoctorSchedules(orgId);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/clinic/doctor-schedules:", err);
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
    const doctorId = typeof body.doctor_id === "string" ? body.doctor_id.trim() : null;
    const doctorName = typeof body.doctor_name === "string" ? body.doctor_name.trim() : undefined;
    if (!doctorId) return NextResponse.json({ error: "doctor_id required" }, { status: 400 });
    const workDays: DayOfWeek[] = Array.isArray(body.work_days)
      ? body.work_days.filter((d): d is DayOfWeek => DAY_KEYS.includes(d as DayOfWeek))
      : ["monday", "tuesday", "wednesday", "thursday", "friday"];
    const workStart = typeof body.work_start === "string" ? body.work_start : "09:00";
    const workEnd = typeof body.work_end === "string" ? body.work_end : "17:00";
    const slotDuration = typeof body.slot_duration_minutes === "number" ? body.slot_duration_minutes : 30;
    const procedures = Array.isArray(body.procedures)
      ? (body.procedures as string[]).filter((x) => typeof x === "string" && x.trim())
      : [];
    const id = await upsertDoctorSchedule(orgId, doctorId, {
      doctor_name: doctorName,
      work_days: workDays,
      work_start: workStart,
      work_end: workEnd,
      slot_duration_minutes: slotDuration,
      procedures: procedures.length > 0 ? procedures : undefined,
    });
    return NextResponse.json({ id, success: true });
  } catch (err) {
    console.error("POST /api/clinic/doctor-schedules:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
