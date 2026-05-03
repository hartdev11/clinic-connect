/**
 * Shared auth + range parsing for analytics API routes
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { parseAnalyticsRange, type AnalyticsDateRange } from "@/lib/analytics-data";

export type AnalyticsContext = {
  orgId: string;
  branchId: string | null;
  allowedBranchIds: string[] | null;
  range: AnalyticsDateRange;
};

export async function getAnalyticsContext(
  request: NextRequest
): Promise<{ context: AnalyticsContext } | { response: NextResponse }> {
  const session = await getSessionFromCookies();
  if (!session) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) {
    return { response: NextResponse.json({ error: "Organization not found" }, { status: 404 }) };
  }
  const user = await getEffectiveUser(session);
  const searchParams = request.nextUrl.searchParams;
  const branchId = searchParams.get("branchId") ?? session.branch_id ?? null;
  const allowedBranchIds =
    user.role === "owner" || user.role === "super_admin"
      ? null
      : user.branch_ids && user.branch_ids.length > 0
        ? user.branch_ids
        : user.branch_roles && Object.keys(user.branch_roles).length > 0
          ? Object.keys(user.branch_roles)
          : [];
  if ((user.role === "manager" || user.role === "staff") && !branchId) {
    return {
      response: NextResponse.json(
        { error: "กรุณาเลือกสาขาก่อนดู Analytics (จำกัดสิทธิ์ตามสาขา)" },
        { status: 403 }
      ),
    };
  }
  if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
    return {
      response: NextResponse.json(
        { error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึงสาขานี้" },
        { status: 403 }
      ),
    };
  }
  const rangeParam = searchParams.get("range") ?? "7d";
  const customFrom = searchParams.get("from") ?? undefined;
  const customTo = searchParams.get("to") ?? undefined;
  const range = parseAnalyticsRange(rangeParam, customFrom, customTo);
  return {
    context: { orgId, branchId, allowedBranchIds, range },
  };
}
