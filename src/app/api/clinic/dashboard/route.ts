import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import {
  getOrgIdFromClinicId,
  getDashboardStats,
  getDashboardBookingsByDate,
  getDashboardChartData,
  getActivePromotionsCount,
  getPendingBookingsCount,
  getUnlabeledFeedbackCount,
  getChatsWoW,
  getBookingsWoW,
} from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { isOrgCircuitOpen } from "@/lib/org-circuit-breaker";

/** ข้อมูล Dashboard — ข้อมูลจริงจาก Firestore ไม่ใช้ mock */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export type DashboardAlert = {
  id: string;
  type: "warning" | "info";
  message: string;
  time: string;
  actionUrl?: string;
};

export async function GET(request: NextRequest) {
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
    const branchId = request.nextUrl.searchParams.get("branchId") ?? session.branch_id ?? null;
    if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json(
        { error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึงสาขานี้" },
        { status: 403 }
      );
    }
    const [
      stats,
      bookingsByDate,
      chartData,
      circuitOpen,
      activePromotionsCount,
      pendingBookingsCount,
      unlabeledFeedbackCount,
      chatsWoW,
      bookingsWoW,
    ] = await Promise.all([
      getDashboardStats(orgId, branchId ?? undefined),
      getDashboardBookingsByDate(orgId, branchId ?? undefined),
      getDashboardChartData(orgId, branchId ?? undefined),
      isOrgCircuitOpen(orgId),
      getActivePromotionsCount(orgId, branchId ?? undefined),
      getPendingBookingsCount(orgId, branchId ?? undefined),
      getUnlabeledFeedbackCount(orgId),
      getChatsWoW(orgId),
      getBookingsWoW(orgId, branchId ?? undefined),
    ]);

    const aiAlerts: DashboardAlert[] = [];
    if (circuitOpen) {
      aiAlerts.push({
        id: "circuit-breaker",
        type: "warning",
        message: "AI ถูกปิดชั่วคราว กรุณาลองใหม่ใน 10 นาที",
        time: "ล่าสุด",
      });
    }
    if (pendingBookingsCount > 0) {
      aiAlerts.push({
        id: "pending-bookings",
        type: "warning",
        message: `มีการจองรอยืนยัน ${pendingBookingsCount} รายการ`,
        time: "ล่าสุด",
        actionUrl: "/clinic/booking?status=pending",
      });
    }
    if (aiAlerts.length === 0) {
      aiAlerts.push({
        id: "status-ok",
        type: "info",
        message: "ระบบ AI ปกติ",
        time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      });
    }

    return NextResponse.json({
      stats,
      bookingsByDate,
      chartData,
      aiAlerts,
      fetchedAt: new Date().toISOString(),
      activePromotionsCount,
      pendingBookingsCount,
      unlabeledFeedbackCount,
      chatsWoW,
      bookingsWoW,
    });
  } catch (err) {
    console.error("GET /api/clinic/dashboard:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
