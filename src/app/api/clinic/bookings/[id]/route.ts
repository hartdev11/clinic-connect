/**
 * PATCH /api/clinic/bookings/[id] — แก้ไขการจอง
 * Enterprise: แก้ไขข้อมูล รายการ หรือยกเลิก
 * Notification: Backend กำหนด requiresCustomerNotification เท่านั้น ไม่ใช้ chatUserId+channel อย่างเดียว
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getBookingById, updateBooking } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess, requireRole } from "@/lib/rbac";
import {
  computeRequiresCustomerNotification,
  sendBookingConfirmation,
} from "@/lib/booking-notification";
import type { BookingChannel } from "@/types/clinic";
import { runWithObservability } from "@/lib/observability/run-with-observability";

const VALID_CHANNELS = ["line", "facebook", "instagram", "tiktok", "web", "web_chat", "walk_in", "phone", "referral", "other"] as const;
const VALID_STATUSES = ["pending", "confirmed", "in_progress", "completed", "no-show", "cancelled", "pending_admin_confirm", "reschedule_pending_admin", "cancel_requested"] as const;

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return runWithObservability("/api/clinic/bookings/[id]", request, async () => {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id: bookingId } = await params;
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager", "staff"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const booking = await getBookingById(orgId, bookingId);
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, booking.branch_id ?? null)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updates: Parameters<typeof updateBooking>[2] = {};

    if (typeof body.customerName === "string" && body.customerName.trim()) updates.customerName = body.customerName.trim();
    if (typeof body.phoneNumber === "string") updates.phoneNumber = body.phoneNumber.trim() || null;
    if (typeof body.service === "string" && body.service.trim()) updates.service = body.service.trim();
    if (typeof body.doctor === "string") updates.doctor = body.doctor.trim() || null;
    if (typeof body.procedure === "string") updates.procedure = body.procedure.trim() || null;
    if (typeof body.amount === "number") updates.amount = body.amount;
    if (typeof body.notes === "string") updates.notes = body.notes.trim() || null;
    if (typeof body.scheduledAt === "string") updates.scheduledAt = body.scheduledAt;
    if (typeof body.status === "string" && VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
      updates.status = body.status as (typeof VALID_STATUSES)[number];
    }
    if (typeof body.channel === "string" && VALID_CHANNELS.includes(body.channel as (typeof VALID_CHANNELS)[number])) {
      updates.channel = body.channel as BookingChannel;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid updates" }, { status: 400 });
    }

    // Enterprise: Backend computes requiresCustomerNotification — never use chatUserId+channel alone
    const statusChangedToConfirmed = updates.status === "confirmed" && booking.status !== "confirmed";
    const merged = { ...booking, ...updates };
    const requiresNotify = computeRequiresCustomerNotification(
      merged,
      statusChangedToConfirmed
    );
    if (requiresNotify) {
      updates.requiresCustomerNotification = true;
      updates.notificationStatus = "pending";
    }

    const ok = await updateBooking(orgId, bookingId, updates);
    if (!ok) return NextResponse.json({ error: "Update failed" }, { status: 500 });

    // Enterprise: ส่งแจ้งเตือนเฉพาะเมื่อ requiresCustomerNotification === true
    // หาก notificationStatus = "failed" → sendBookingConfirmation จะไม่ retry (รอ backend)
    if (requiresNotify) {
      const updatedBooking = await getBookingById(orgId, bookingId);
      if (updatedBooking && updatedBooking.notificationStatus !== "failed") {
        sendBookingConfirmation({ orgId, bookingId, booking: updatedBooking }).catch((err) =>
          console.warn("[Booking PATCH] Notification failed:", (err as Error).message)
        );
      }
    }

    return { response: NextResponse.json({ success: true }), orgId, branchId: booking.branch_id ?? null };
  } catch (err) {
    console.error("PATCH /api/clinic/bookings/[id]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}
