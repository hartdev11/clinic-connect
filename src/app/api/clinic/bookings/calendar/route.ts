/**
 * GET /api/clinic/bookings/calendar?year=&month=&branchId=&doctorId=
 * Enterprise: ข้อมูลปฏิทิน — วันที่มีการจอง + count + datesWithStatus
 * Cache: 30s (ลด load เมื่อเปลี่ยน filter บ่อย)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getBookingsForCalendar } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const CACHE_MAX_AGE = 30;

const CALENDAR_RATE_MAX = 60;
const CALENDAR_RATE_WINDOW = 60;
const calendarRequestCounts = new Map<string, { count: number; resetAt: number }>();
function checkCalendarRateLimit(orgId: string): boolean {
  const now = Date.now();
  const key = `cal:${orgId}`;
  let e = calendarRequestCounts.get(key);
  if (!e || now > e.resetAt) {
    e = { count: 0, resetAt: now + CALENDAR_RATE_WINDOW * 1000 };
    calendarRequestCounts.set(key, e);
  }
  e.count++;
  return e.count <= CALENDAR_RATE_MAX;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    const { searchParams } = new URL(request.url);
    const year = Math.min(Math.max(Number(searchParams.get("year")) || new Date().getFullYear(), 2020), 2030);
    const month = Math.min(Math.max(Number(searchParams.get("month")) || new Date().getMonth() + 1, 1), 12);
    const branchId = searchParams.get("branchId") ?? undefined;
    const channel = searchParams.get("channel") ?? undefined;
    const doctorId = searchParams.get("doctorId") ?? undefined;
    if (branchId && !requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }
    if (!checkCalendarRateLimit(orgId)) {
      return NextResponse.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 });
    }
    const { datesWithCount, datesWithStatus, items } = await getBookingsForCalendar(orgId, year, month, {
      branchId,
      channel,
      doctorId,
    });
    const headers = new Headers();
    headers.set("Cache-Control", `private, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=10`);
    return NextResponse.json({ datesWithCount, datesWithStatus, items }, { headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/clinic/bookings/calendar:", err);
    const status = msg.includes("Firebase") || msg.includes("permission") ? 503 : 500;
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? msg : "Server error", code: "CALENDAR_ERROR" },
      { status }
    );
  }
}
