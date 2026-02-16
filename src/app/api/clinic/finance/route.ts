/**
 * GET /api/clinic/finance — Executive Finance Control Center
 * 🚨 INTERNAL_FINANCE_ONLY — Never expose to customer chat or public API.
 * RBAC: Owner and Manager only. Staff denied.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess, requireRole } from "@/lib/rbac";
import { getExecutiveFinanceData } from "@/lib/financial-data/executive";
import type { DatePeriod } from "@/lib/financial-data/executive";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["owner", "manager"] as const;

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/finance", request, async () => {
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
      if (!requireRole(user.role, [...ALLOWED_ROLES])) {
        return NextResponse.json(
          { error: "Finance จำกัดสิทธิ์เฉพาะ Owner และ Manager" },
          { status: 403 }
        );
      }
      const branchId = request.nextUrl.searchParams.get("branchId") ?? session.branch_id ?? null;
      if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
        return NextResponse.json(
          { error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึง Finance ของสาขานี้" },
          { status: 403 }
        );
      }
      const period = (request.nextUrl.searchParams.get("period") as DatePeriod) || "month";
      const periodValue =
        request.nextUrl.searchParams.get("periodValue") ||
        (period === "month"
          ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
          : period === "quarter"
            ? `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`
            : String(new Date().getFullYear()));

      const data = await getExecutiveFinanceData(orgId, branchId, period, periodValue);
      return {
        response: NextResponse.json(data),
        orgId,
        branchId,
      };
    } catch (err) {
      console.error("GET /api/clinic/finance:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
