/**
 * Refresh LINE profile — ดึง displayName + pictureUrl ล่าสุดจาก LINE API
 * สำหรับลูกค้าที่มีอยู่แล้วแต่ยังเป็น "ลูกค้า LINE"
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getCustomerById, upsertLineCustomer } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { requireOrgIsolation } from "@/lib/org-isolation";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";

export const dynamic = "force-dynamic";

/** 30 req/min per org — ป้องกัน spam LINE Profile API */
const REFRESH_PROFILE_LIMIT = { windowSeconds: 60, max: 30 };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;

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
    if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, session.branch_id)) {
      return NextResponse.json({ error: "จำกัดสิทธิ์" }, { status: 403 });
    }

    const customer = await getCustomerById(orgId, customerId);
    if (!customer) {
      return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });
    }
    requireOrgIsolation(session, customer.org_id, { resource: "customer", id: customerId });

    if (customer.source !== "line" || !customer.externalId) {
      return NextResponse.json(
        { error: "Refresh profile รองรับเฉพาะลูกค้าจาก LINE" },
        { status: 400 }
      );
    }

    const rate = await checkDistributedRateLimit(
      `refresh_profile:${orgId}`,
      REFRESH_PROFILE_LIMIT.max,
      REFRESH_PROFILE_LIMIT.windowSeconds
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "รีเฟรชโปรไฟล์เร็วเกินไป กรุณารอสักครู่", retryAfterMs: rate.retryAfterMs },
        { status: 429 }
      );
    }

    await upsertLineCustomer(orgId, customer.externalId, {
      branchId: customer.branch_id ?? null,
    });

    const updated = await getCustomerById(orgId, customerId);
    return NextResponse.json({
      ok: true,
      name: updated?.name ?? customer.name,
      pictureUrl: updated?.pictureUrl ?? customer.pictureUrl,
    });
  } catch (err) {
    console.error("POST /api/clinic/customers/[id]/refresh-profile:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
