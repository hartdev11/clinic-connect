/**
 * E5.1–E5.2 — Conversation Feedback API
 * GET: list feedback for admin
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, listConversationFeedback, getUnlabeledFeedbackCount } from "@/lib/clinic-data";
import { requireRole } from "@/lib/rbac";
import { getEffectiveUser } from "@/lib/rbac";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";

export const dynamic = "force-dynamic";

/** 60 req/min per org */
const FEEDBACK_GET_LIMIT = { windowSeconds: 60, max: 60 };

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
    if (!requireRole(user.role, ["owner", "manager", "staff"])) {
      return NextResponse.json(
        { error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึง Feedback" },
        { status: 403 }
      );
    }
    const rate = await checkDistributedRateLimit(
      `feedback:${orgId}`,
      FEEDBACK_GET_LIMIT.max,
      FEEDBACK_GET_LIMIT.windowSeconds
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "โหลดเร็วเกินไป กรุณารอสักครู่", retryAfterMs: rate.retryAfterMs },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
    const startAfterId = searchParams.get("startAfter") ?? undefined;
    const unlabeledOnly = searchParams.get("unlabeledOnly") === "true";

    const [{ items, lastId }, unlabeledCount] = await Promise.all([
      listConversationFeedback(orgId, { limit, startAfterId, unlabeledOnly }),
      getUnlabeledFeedbackCount(orgId),
    ]);
    return NextResponse.json({ items, lastId, unlabeledCount });
  } catch (err) {
    console.error("GET /api/clinic/feedback:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
