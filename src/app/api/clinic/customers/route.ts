import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getCustomers } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";

export const dynamic = "force-dynamic";

/** 60 req/min per org */
const CUSTOMERS_LIMIT = { windowSeconds: 60, max: 60 };

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
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") ?? session.branch_id ?? null;
    if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json(
        { error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึงลูกค้าของสาขานี้" },
        { status: 403 }
      );
    }
    const rate = await checkDistributedRateLimit(
      `customers:${orgId}`,
      CUSTOMERS_LIMIT.max,
      CUSTOMERS_LIMIT.windowSeconds
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "โหลดเร็วเกินไป กรุณารอสักครู่", retryAfterMs: rate.retryAfterMs },
        { status: 429 }
      );
    }
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
    const startAfter = searchParams.get("startAfter") ?? undefined;
    const allBranches = searchParams.get("allBranches") === "true";
    const sourceParam = searchParams.get("source");
    const validSource = ["line", "facebook", "instagram", "tiktok", "web"].includes(sourceParam || "")
      ? (sourceParam as "line" | "facebook" | "instagram" | "tiktok" | "web")
      : undefined;
    const { items, lastId } = await getCustomers(orgId, {
      branchId: allBranches ? undefined : (branchId ?? undefined),
      limit,
      startAfterId: startAfter,
      source: validSource,
    });
    return NextResponse.json({ items, lastId });
  } catch (err) {
    console.error("GET /api/clinic/customers:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
