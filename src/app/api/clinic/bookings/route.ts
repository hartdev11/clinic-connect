import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getBookings, createBookingAtomic, getBranchesByOrgId } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess, requireRole } from "@/lib/rbac";
import { isSlotAvailable } from "@/lib/slot-engine";
import type { BookingCreate, BookingSource, BookingChannel } from "@/types/clinic";
import { runWithObservability } from "@/lib/observability/run-with-observability";

const VALID_CHANNELS = ["line", "facebook", "instagram", "tiktok", "web", "walk_in", "phone", "referral", "other"] as const;

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return runWithObservability("/api/clinic/bookings", request, async () => {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager", "staff"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
    const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : undefined;
    const service = typeof body.service === "string" ? body.service.trim() : "";
    const scheduledAt = typeof body.scheduledAt === "string" ? body.scheduledAt : "";
    if (!customerName || !service || !scheduledAt) {
      return NextResponse.json({ error: "customerName, service, scheduledAt required" }, { status: 400 });
    }
    const branchId = typeof body.branchId === "string" ? body.branchId : undefined;
    if (branchId && !requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const branches = await getBranchesByOrgId(orgId);
    const branch = branchId ? branches.find((b) => b.id === branchId) : branches[0];
    const effectiveBranchId = branchId ?? branch?.id;
    if (effectiveBranchId) {
      const slotCheck = await isSlotAvailable(orgId, effectiveBranchId, scheduledAt, { durationMinutes: 30 });
      if (!slotCheck.available) {
        return NextResponse.json(
          {
            error: "ช่วงเวลานี้ไม่ว่าง มีการจองซ้ำกับคิวอื่น",
            code: "SLOT_CONFLICT",
            alternatives: slotCheck.alternatives?.map((a) => ({ start: a.start, startISO: a.startISO })),
          },
          { status: 409 }
        );
      }
    }
    const channelVal = typeof body.channel === "string" && VALID_CHANNELS.includes(body.channel as (typeof VALID_CHANNELS)[number]) ? body.channel : undefined;
    const data: BookingCreate = {
      customerName,
      customerId: typeof body.customerId === "string" ? body.customerId : undefined,
      phoneNumber: phoneNumber || undefined,
      service,
      procedure: typeof body.procedure === "string" ? body.procedure : undefined,
      doctor: typeof body.doctor === "string" ? body.doctor.trim() || undefined : undefined,
      amount: typeof body.amount === "number" ? body.amount : undefined,
      source: (typeof body.source === "string" && ["line", "web", "admin", "ai"].includes(body.source) ? body.source : "admin") as BookingSource,
      channel: channelVal as BookingChannel | undefined,
      branch_id: branchId ?? branch?.id,
      branchId: branchId ?? branch?.id,
      branchName: branch?.name,
      scheduledAt,
      status: (typeof body.status === "string" && ["pending", "confirmed", "in_progress", "completed", "no-show", "cancelled", "pending_admin_confirm", "reschedule_pending_admin", "cancel_requested"].includes(body.status) ? body.status : "pending") as BookingCreate["status"],
      notes: typeof body.notes === "string" ? body.notes : undefined,
    };
    const result = await createBookingAtomic(orgId, data, { durationMinutes: 30 });
    if ("error" in result) {
      return NextResponse.json({ error: "ช่วงเวลานี้ไม่ว่าง", code: "SLOT_TAKEN" }, { status: 409 });
    }
    return { response: NextResponse.json({ id: result.id, success: true }), orgId, branchId: branchId ?? branch?.id ?? null };
  } catch (err) {
    console.error("POST /api/clinic/bookings:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/bookings", request, async () => {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    const user = await getEffectiveUser(session);
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") ?? session.branch_id ?? null;
    if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json(
        { error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึง Booking ของสาขานี้" },
        { status: 403 }
      );
    }
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
    const startAfter = searchParams.get("startAfter") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const channel = searchParams.get("channel") ?? undefined;
    const { items, lastId } = await getBookings(orgId, {
      branchId: branchId ?? undefined,
      limit,
      startAfterId: startAfter,
      status: status || undefined,
      channel: channel && VALID_CHANNELS.includes(channel as (typeof VALID_CHANNELS)[number]) ? channel : undefined,
    });
    return { response: NextResponse.json({ items, lastId, hasMore: !!lastId }), orgId, branchId };
  } catch (err) {
    console.error("GET /api/clinic/bookings:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}
