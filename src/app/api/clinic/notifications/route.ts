/**
 * Notification Center API — รวมแจ้งเตือนทุกประเภท แยกตาม severity
 * URGENT / WARNING / INFO
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import {
  getOrgIdFromClinicId,
  getPendingBookingsCount,
  getUnlabeledFeedbackCount,
  getPromotionsExpiringSoon,
  getDashboardStats,
} from "@/lib/clinic-data";
import { isOrgCircuitOpen } from "@/lib/org-circuit-breaker";
import { getDailyLLMCost } from "@/lib/llm-metrics";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type NotificationSeverity = "urgent" | "warning" | "info";

export type Notification = {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionUrl?: string;
  count?: number;
  timestamp: string;
};

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/notifications", request, async () => {
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
      pendingBookingsCount,
      circuitOpen,
      unlabeledFeedbackCount,
      dailyCost,
      promotionsExpiring,
      stats,
    ] = await Promise.all([
      getPendingBookingsCount(orgId, branchId ?? undefined),
      isOrgCircuitOpen(orgId),
      getUnlabeledFeedbackCount(orgId),
      getDailyLLMCost(orgId),
      getPromotionsExpiringSoon(orgId, branchId ?? undefined, 7),
      getDashboardStats(orgId, branchId ?? undefined),
    ]);

    const limitBaht = Number(process.env.MAX_DAILY_LLM_COST_BAHT ?? 0);
    const usageRatio = limitBaht > 0 ? dailyCost / limitBaht : 0;
    const newCustomersToday = stats?.newCustomers ?? 0;

    const notifications: Notification[] = [];
    const now = new Date().toISOString();

    // URGENT
    if (pendingBookingsCount > 0) {
      notifications.push({
        id: "pending-bookings",
        type: "pending_booking",
        severity: "urgent",
        title: "การจองรอยืนยัน",
        message: `มี ${pendingBookingsCount} รายการรอยืนยัน`,
        actionUrl: "/clinic/booking?status=pending",
        count: pendingBookingsCount,
        timestamp: now,
      });
    }
    if (circuitOpen) {
      notifications.push({
        id: "circuit-breaker",
        type: "circuit_breaker",
        severity: "urgent",
        title: "AI ถูกปิดชั่วคราว",
        message: "Circuit breaker เปิดอยู่ กรุณาลองใหม่ใน 10 นาที",
        timestamp: now,
      });
    }

    // WARNING
    if (limitBaht > 0 && usageRatio >= 0.8) {
      notifications.push({
        id: "llm-limit-warning",
        type: "daily_limit",
        severity: "warning",
        title: "Daily limit ใกล้เต็ม",
        message: `ใช้ไป ${(usageRatio * 100).toFixed(0)}% ของงบ AI วันนี้`,
        actionUrl: "/clinic/admin-monitoring",
        count: Math.round(usageRatio * 100),
        timestamp: now,
      });
    }
    if (promotionsExpiring.length > 0) {
      notifications.push({
        id: "promotions-expiring",
        type: "promotion_expiring",
        severity: "warning",
        title: "โปรโมชันใกล้หมด",
        message: `${promotionsExpiring.length} โปรโมชันหมดอายุภายใน 7 วัน`,
        actionUrl: "/clinic/promotions",
        count: promotionsExpiring.length,
        timestamp: now,
      });
    }

    // INFO
    if (unlabeledFeedbackCount > 0) {
      notifications.push({
        id: "unlabeled-feedback",
        type: "chat_unlabeled",
        severity: "info",
        title: "แชทรอประเมิน",
        message: `${unlabeledFeedbackCount} แชทรอการประเมิน feedback`,
        actionUrl: "/clinic/customers?tab=feedback",
        count: unlabeledFeedbackCount,
        timestamp: now,
      });
    }
    if (newCustomersToday > 0) {
      notifications.push({
        id: "new-customers",
        type: "new_customers",
        severity: "info",
        title: "ลูกค้าใหม่วันนี้",
        message: `${newCustomersToday} รายการ`,
        actionUrl: "/clinic/customers",
        count: newCustomersToday,
        timestamp: now,
      });
    }

    const urgent = notifications.filter((n) => n.severity === "urgent");
    const warning = notifications.filter((n) => n.severity === "warning");
    const info = notifications.filter((n) => n.severity === "info");

    return {
      response: NextResponse.json({
        notifications,
        grouped: { urgent, warning, info },
        totalCount: notifications.length,
        fetchedAt: now,
      }),
      orgId,
      branchId,
    };
  } catch (err) {
    console.error("GET /api/clinic/notifications:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}
