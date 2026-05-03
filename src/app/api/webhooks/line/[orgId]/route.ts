/**
 * LINE Webhook — Multi-tenant ingress
 * POST /api/webhooks/line/[orgId]
 *
 * Route นี้โหลดเฉพาะสิ่งที่จำเป็นสำหรับตรวจลายเซ็นก่อน — โปรเซสข้อความอยู่ใน `@/lib/line-webhook-processor`
 * (dynamic import หลังอ่าน body) เพื่อลด cold-compile ดึง bullmq แล้ว body ว่างใน dev
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyLineSignature } from "@/lib/line-webhook";
import { randomUUID } from "crypto";
import { getLineChannelByOrgId } from "@/lib/line-channel-data";
import { getRequestId } from "@/lib/request-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const correlationId = getRequestId(request) ?? randomUUID();
  const signature = request.headers.get("x-line-signature") ?? "";

  let rawBodyBytes: Buffer;
  try {
    rawBodyBytes = Buffer.from(await request.arrayBuffer());
  } catch (err) {
    console.error("[LINE Webhook] Read body error:", { correlationId, err });
    return NextResponse.json({ error: "Cannot read request body" }, { status: 400 });
  }

  if (rawBodyBytes.length === 0) {
    if (signature) {
      // มักเกิดหลัง compile ช้า / proxy — ให้ LINE ส่งซ้ำ (มีลายเซ็นแต่ body หาย)
      console.warn("[LINE Webhook] Empty body with signature — 503 เพื่อให้ฝั่ง LINE retry", {
        correlationId,
      });
      return NextResponse.json(
        { error: "empty_body_retry" },
        { status: 503, headers: { "Retry-After": "1" } }
      );
    }
    return NextResponse.json({ ok: true, ignored: true });
  }

  const rawBody = rawBodyBytes.toString("utf8");
  const { orgId } = await params;

  if (!orgId) {
    console.error("[LINE Webhook] Missing orgId", { correlationId });
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  const channel = await getLineChannelByOrgId(orgId);
  if (!channel) {
    return NextResponse.json({ error: "LINE channel not configured for this org" }, { status: 404 });
  }

  const channelSecret = channel.channel_secret.trim();
  const channelToken = channel.channel_access_token;

  if (!signature || !verifyLineSignature(rawBodyBytes, signature, channelSecret)) {
    return NextResponse.json({ error: "Invalid LINE signature" }, { status: 401 });
  }

  const { processLineWebhookInbound } = await import("@/lib/line-webhook-processor");
  await processLineWebhookInbound(orgId, channelToken, rawBody, correlationId);

  return NextResponse.json({ ok: true }, { status: 200 });
}
