/**
 * Enterprise: Queue API — คิวการจองตามวันที่
 * GET /api/clinic/bookings/queue?date=YYYY-MM-DD&branchId=xxx&groupByDoctor=true
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getBookingsQueue } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/bookings/queue", request, async () => {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const rawBranchId = searchParams.get("branchId") ?? session.branch_id ?? null;
    const branchId = rawBranchId === "all" ? null : rawBranchId;
    const groupByDoctor = searchParams.get("groupByDoctor") === "true";

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const items = await getBookingsQueue(orgId, dateStr, {
      branchId: branchId ?? undefined,
      groupByDoctor,
    });

    return {
      response: NextResponse.json({
        date: dateStr,
        branchId: branchId ?? null,
        items,
        total: items.length,
      }),
      orgId,
      branchId,
    };
  } catch (err) {
    console.error("GET /api/clinic/bookings/queue:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}
