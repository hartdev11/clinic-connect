/**
 * LINE Connection — Multi-tenant
 * GET: สถานะการเชื่อมต่อ (ไม่ส่ง secret/token)
 * PUT: บันทึก credentials (validate ด้วย LINE API ก่อน)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-session";
import { getEffectiveUser, requireRole } from "@/lib/rbac";
import {
  getLineChannelStatus,
  upsertLineChannel,
} from "@/lib/line-channel-data";
import { getLineBotInfo } from "@/lib/line-api";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

/** GET — สถานะ LINE (owner/manager เท่านั้น) */
export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/line", request, async () => {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.org_id) {
      return NextResponse.json(
        { error: "ต้องเข้าสู่ระบบ" },
        { status: 401 }
      );
    }
    const effective = await getEffectiveUser(session);
    if (!requireRole(effective.role, ["owner", "manager"])) {
      return NextResponse.json(
        { error: "จำกัดสิทธิ์: เฉพาะ Owner หรือ Manager" },
        { status: 403 }
      );
    }

    const status = await getLineChannelStatus(session.org_id);
    return { response: NextResponse.json(status), orgId: session.org_id };
  } catch (err) {
    console.error("[API /api/clinic/line] GET:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
  });
}

/** PUT — บันทึก LINE credentials (owner/manager เท่านั้น) */
export async function PUT(request: NextRequest) {
  return runWithObservability("/api/clinic/line", request, async () => {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.org_id) {
      return NextResponse.json(
        { error: "ต้องเข้าสู่ระบบ" },
        { status: 401 }
      );
    }
    const effective = await getEffectiveUser(session);
    if (!requireRole(effective.role, ["owner", "manager"])) {
      return NextResponse.json(
        { error: "จำกัดสิทธิ์: เฉพาะ Owner หรือ Manager" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const channelSecret = body?.channel_secret?.trim();
    const channelAccessToken = body?.channel_access_token?.trim();
    const channelId = body?.channel_id?.trim() || "default";

    if (!channelSecret || !channelAccessToken) {
      return NextResponse.json(
        { error: "ต้องกรอก Channel Secret และ Channel Access Token" },
        { status: 400 }
      );
    }

    // Validate token และดึง bot userId
    const botInfo = await getLineBotInfo(channelAccessToken);
    if (!botInfo) {
      return NextResponse.json(
        { error: "Token ไม่ถูกต้อง หรือไม่สามารถเชื่อมต่อ LINE API ได้ — ตรวจสอบ Channel Access Token" },
        { status: 400 }
      );
    }

    await upsertLineChannel(
      {
        org_id: session.org_id,
        channel_id: channelId,
        channel_secret: channelSecret,
        channel_access_token: channelAccessToken,
      },
      botInfo.userId,
      botInfo.displayName
    );

    const status = await getLineChannelStatus(session.org_id);
    return { response: NextResponse.json(status), orgId: session.org_id };
  } catch (err) {
    console.error("[API /api/clinic/line] PUT:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
  });
}
