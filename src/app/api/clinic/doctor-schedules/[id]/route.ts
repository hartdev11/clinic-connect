/**
 * Enterprise: Doctor Schedule PATCH/DELETE
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getDoctorScheduleByDocId, upsertDoctorSchedule } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import { db } from "@/lib/firebase-admin";
import type { DayOfWeek } from "@/types/clinic";

export const dynamic = "force-dynamic";

const DAY_KEYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const existing = await getDoctorScheduleByDocId(orgId, id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(existing);
  } catch (err) {
    console.error("GET /api/clinic/doctor-schedules/[id]:", err);
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
    const { id } = await params;
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const existing = await getDoctorScheduleByDocId(orgId, id);
    if (!existing) return NextResponse.json({ error: "Doctor schedule not found" }, { status: 404 });
    const body = (await request.json()) as Record<string, unknown>;
    const workDays = body.work_days
      ? (Array.isArray(body.work_days) ? body.work_days.filter((d) => DAY_KEYS.includes(d as DayOfWeek)) : existing.work_days) as DayOfWeek[]
      : existing.work_days;
    const workStart = typeof body.work_start === "string" ? body.work_start : existing.work_start;
    const workEnd = typeof body.work_end === "string" ? body.work_end : existing.work_end;
    const slotDuration = typeof body.slot_duration_minutes === "number" ? body.slot_duration_minutes : existing.slot_duration_minutes ?? 30;
    const doctorName = typeof body.doctor_name === "string" ? body.doctor_name.trim() : existing.doctor_name;
    const procedures = body.procedures !== undefined
      ? (Array.isArray(body.procedures) ? body.procedures : []).filter((x: unknown) => typeof x === "string" && String(x).trim())
      : existing.procedures ?? [];
    await upsertDoctorSchedule(orgId, existing.doctor_id, {
      doctor_name: doctorName,
      work_days: workDays,
      work_start: workStart,
      work_end: workEnd,
      slot_duration_minutes: slotDuration,
      procedures,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/clinic/doctor-schedules/[id]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const doc = await db.collection("doctor_schedules").doc(id).get();
    if (!doc.exists || doc.data()?.org_id !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await db.collection("doctor_schedules").doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/clinic/doctor-schedules/[id]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
