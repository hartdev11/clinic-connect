/**
 * Admin Manual Reply — ส่งข้อความถึงลูกค้าผ่าน LINE Push API
 * Enterprise: audit, rate limit, validation, adminSentBy
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getCustomerById, createConversationFeedback } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { requireOrgIsolation } from "@/lib/org-isolation";
import { getLineChannelByOrgId } from "@/lib/line-channel-data";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import { writeAuditLog } from "@/lib/audit-log";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_MAX_TEXT_LENGTH = 5000;
/** 20 messages / min per org */
const MANUAL_REPLY_LIMIT = { windowSeconds: 60, max: 20 };

function truncateForLine(text: string): string {
  if (text.length <= LINE_MAX_TEXT_LENGTH) return text;
  return text.slice(0, LINE_MAX_TEXT_LENGTH - 3) + "...";
}

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

    const lineUserId = customer.externalId;
    if (!lineUserId) {
      return NextResponse.json(
        { error: "ลูกค้ารายนี้ยังไม่มี LINE ID — ยังไม่ได้แชทกับบอท" },
        { status: 400 }
      );
    }

    if (customer.source !== "line") {
      return NextResponse.json(
        { error: "การตอบแชทด้วยตนเองรองรับเฉพาะลูกค้าจาก LINE" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "กรุณากรอกข้อความ" }, { status: 400 });
    }

    const rateKey = `manual_reply:${orgId}`;
    const rate = await checkDistributedRateLimit(
      rateKey,
      MANUAL_REPLY_LIMIT.max,
      MANUAL_REPLY_LIMIT.windowSeconds
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "ส่งข้อความเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่", retryAfterMs: rate.retryAfterMs },
        { status: 429 }
      );
    }

    let accessToken: string | null = null;
    const channel = await getLineChannelByOrgId(orgId);
    if (channel?.channel_access_token) {
      accessToken = channel.channel_access_token;
    } else if (process.env.LINE_ORG_ID === orgId && process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim()) {
      accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN.trim();
    }
    if (!accessToken) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า LINE Channel สำหรับ org นี้" },
        { status: 400 }
      );
    }

    const safeText = truncateForLine(text);
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text: safeText }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[LINE Push] API error:", res.status, errText);
      return NextResponse.json(
        { error: "ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบ LINE Channel" },
        { status: 502 }
      );
    }

    const adminUserId = session.user_id ?? session.clinicId ?? "unknown";
    const adminEmail = session.email ?? undefined;

    await createConversationFeedback({
      org_id: orgId,
      branch_id: customer.branch_id ?? null,
      user_id: lineUserId,
      userMessage: "",
      botReply: safeText,
      source: "admin",
      adminSentBy: adminEmail || adminUserId,
    });

    writeAuditLog({
      event: "manual_reply",
      org_id: orgId,
      user_id: adminUserId,
      email: adminEmail,
      details: {
        customerId,
        lineUserId,
        textLength: safeText.length,
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/clinic/customers/[id]/send-message:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
