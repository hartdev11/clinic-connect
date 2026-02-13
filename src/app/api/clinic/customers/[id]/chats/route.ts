/**
 * แชทของลูกค้า — ดึงจาก conversation_feedback ตาม LINE user_id
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getCustomerById, listConversationFeedbackByUserId } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { requireOrgIsolation } from "@/lib/org-isolation";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";

export const dynamic = "force-dynamic";

/** 60 req/min per org */
const CHATS_LIMIT = { windowSeconds: 60, max: 60 };

export async function GET(
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
      return NextResponse.json(
        { error: "จำกัดสิทธิ์" },
        { status: 403 }
      );
    }

    const customer = await getCustomerById(orgId, customerId);
    if (!customer) {
      return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });
    }
    requireOrgIsolation(session, customer.org_id, { resource: "customer", id: customerId });

    const lineUserId = customer.externalId;
    if (!lineUserId) {
      return NextResponse.json({ items: [], lastId: null });
    }

    const rate = await checkDistributedRateLimit(
      `chats:${orgId}`,
      CHATS_LIMIT.max,
      CHATS_LIMIT.windowSeconds
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "โหลดแชทเร็วเกินไป กรุณารอสักครู่", retryAfterMs: rate.retryAfterMs },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const startAfter = searchParams.get("startAfter") ?? undefined;

    const { items, lastId } = await listConversationFeedbackByUserId(
      orgId,
      lineUserId,
      { limit, startAfterId: startAfter }
    );

    return NextResponse.json({ items, lastId });
  } catch (err) {
    console.error("GET /api/clinic/customers/[id]/chats:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
