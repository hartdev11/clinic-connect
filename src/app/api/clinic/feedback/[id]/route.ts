/**
 * E5.1–E5.2 — Conversation Feedback API
 * PATCH: Admin mark success / fail
 * Enterprise: AI Feedback Loop — record สำหรับ prompt improvement
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, updateFeedbackLabel } from "@/lib/clinic-data";
import { requireRole } from "@/lib/rbac";
import { getEffectiveUser } from "@/lib/rbac";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { recordFeedbackForPromptImprovement } from "@/lib/ai/ai-feedback-loop";
import type { FeedbackLabel } from "@/types/clinic";

export const dynamic = "force-dynamic";

/** 60 labels/min per org */
const FEEDBACK_PATCH_LIMIT = { windowSeconds: 60, max: 60 };

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์แก้ไข Feedback" },
        { status: 403 }
      );
    }
    const rate = await checkDistributedRateLimit(
      `feedback_patch:${orgId}`,
      FEEDBACK_PATCH_LIMIT.max,
      FEEDBACK_PATCH_LIMIT.windowSeconds
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "ป้ายเร็วเกินไป กรุณารอสักครู่", retryAfterMs: rate.retryAfterMs },
        { status: 429 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const label = body.label as FeedbackLabel | undefined;
    if (label !== "success" && label !== "fail" && label !== null) {
      return NextResponse.json({ error: "Invalid label: use success, fail, or null" }, { status: 400 });
    }

    const userId = session.user_id ?? "anonymous";
    const result = await updateFeedbackLabel(id, orgId, label, userId);
    if (!result.ok) {
      return NextResponse.json({ error: "Feedback not found or access denied" }, { status: 404 });
    }
    if ((label === "success" || label === "fail") && result.userMessage != null && result.botReply != null) {
      void recordFeedbackForPromptImprovement({
        org_id: orgId,
        feedback_id: id,
        admin_label: label,
        user_message: result.userMessage,
        bot_reply: result.botReply,
        admin_user_id: userId,
        correlation_id: result.correlation_id,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/clinic/feedback/[id]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
