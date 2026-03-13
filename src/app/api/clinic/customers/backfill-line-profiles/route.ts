/**
 * Backfill LINE profile — ดึง displayName + pictureUrl สำหรับลูกค้าเก่าที่ยังไม่มี
 * POST /api/clinic/customers/backfill-line-profiles
 * Body: { limit?: number } — จำนวนสูงสุดที่ backfill ต่อครั้ง (default 10)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import {
  getOrgIdFromClinicId,
  getCustomersNeedingProfileBackfill,
  upsertLineCustomer,
} from "@/lib/clinic-data";
import { getEffectiveUser } from "@/lib/rbac";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";

export const dynamic = "force-dynamic";

/** สูงสุด 20 ต่อครั้ง, 1 ครั้งต่อ 5 นาที per org — ป้องกัน LINE API limit */
const BACKFILL_LIMIT = { max: 20, windowSeconds: 300 };

export async function POST(request: NextRequest) {
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
    const role = user.role;
    if (role !== "owner" && role !== "manager") {
      return NextResponse.json({ error: "เฉพาะ owner หรือ manager เท่านั้น" }, { status: 403 });
    }

    const rate = await checkDistributedRateLimit(
      `backfill_profiles:${orgId}`,
      BACKFILL_LIMIT.max,
      BACKFILL_LIMIT.windowSeconds
    );
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: "Backfill เร็วเกินไป กรุณารอสักครู่",
          retryAfterMs: rate.retryAfterMs,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(1, Number(body?.limit) || 10), 20);

    const customers = await getCustomersNeedingProfileBackfill(orgId, limit);
    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const c of customers) {
      try {
        await upsertLineCustomer(orgId, c.externalId!, { branchId: c.branch_id ?? null });
        results.push({ id: c.id, ok: true });
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        results.push({
          id: c.id,
          ok: false,
          error: (err as Error)?.message?.slice(0, 80),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      success: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err) {
    console.error("POST /api/clinic/customers/backfill-line-profiles:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
