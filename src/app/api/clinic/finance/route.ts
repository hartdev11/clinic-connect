import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getDashboardStats, getTransactions } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { safeAddBaht } from "@/lib/money";

export const dynamic = "force-dynamic";

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
        { error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึง Finance ของสาขานี้" },
        { status: 403 }
      );
    }
    const [stats, { items: transactions }] = await Promise.all([
      getDashboardStats(orgId, branchId ?? undefined),
      getTransactions(orgId, { limit: 30, branchId: branchId ?? undefined }),
    ]);
    const byService: Record<string, number> = {};
    for (const t of transactions) {
      const name = t.serviceName || "อื่นๆ";
      byService[name] = safeAddBaht(byService[name] ?? 0, t.amount);
    }
    return NextResponse.json({
      revenueThisMonth: stats.revenueThisMonth,
      revenueLastMonth: stats.revenueLastMonth,
      transactions,
      byService: Object.entries(byService).map(([name, revenue]) => ({ name, revenue })),
    });
  } catch (err) {
    console.error("GET /api/clinic/finance:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
