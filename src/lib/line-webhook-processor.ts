/**
 * LINE webhook inbound processing — แยกออกจาก route เพื่อไม่ให้ route ดึง bullmq/pipeline ตอน compile
 * (ลดโอกาส body ว่างตอน cold compile ใน dev)
 */
import { parseLineWebhook } from "@/lib/line-webhook";
import { createConversationFeedback, getDefaultBranchId, upsertLineCustomer } from "@/lib/clinic-data";
import { toSignedUrlIfFirebaseStorage } from "@/lib/promotion-storage";
import {
  pushLineMessages,
  pushLineTextMessage,
  replyLineMessages,
  type LineOutboundMessage,
} from "@/lib/line-messaging";
import { randomUUID } from "crypto";
import { claimLineEventProcessing, getMessageHash } from "@/lib/line-idempotency";

async function enqueueLineWebhookRetry(data: {
  orgId: string;
  lineUserId: string;
  text: string;
  branchId: string | null;
  correlationId: string;
}): Promise<void> {
  try {
    const { enqueueWebhookRetry } = await import("@/lib/webhook-retry-queue");
    const eventId = `${data.orgId}:${data.lineUserId}:${Date.now()}:${randomUUID().slice(0, 8)}`;
    await enqueueWebhookRetry({
      source: "line",
      eventId,
      eventType: "line.message.retry",
      payload: {
        orgId: data.orgId,
        lineUserId: data.lineUserId,
        text: data.text,
        branchId: data.branchId,
        correlationId: data.correlationId,
      },
    });
  } catch (err) {
    console.warn("[LINE Webhook] enqueue retry failed", {
      correlationId: data.correlationId,
      err: (err as Error)?.message,
    });
  }
}

export async function processLineWebhookInbound(
  orgId: string,
  channelAccessToken: string,
  rawBody: string,
  correlationId: string
): Promise<void> {
  try {
    const defaultBranchId = await getDefaultBranchId(orgId);
    const parsed = parseLineWebhook(rawBody);
    const events = Array.isArray(parsed.events) ? parsed.events : [];
    const token = channelAccessToken.trim();

    for (const event of events) {
      if (event?.type !== "message" || event?.message?.type !== "text") continue;
      const lineUserId = event?.source?.userId?.trim();
      const text = event?.message?.text?.trim();
      const replyToken = typeof event?.replyToken === "string" ? event.replyToken.trim() : "";
      if (!lineUserId || !text) continue;
      if (replyToken) {
        const messageHash = getMessageHash(text);
        const claimed = await claimLineEventProcessing(replyToken, lineUserId, messageHash);
        if (!claimed) {
          console.log("[LINE Webhook] duplicate event skipped", { correlationId, lineUserId });
          continue;
        }
      }

      await upsertLineCustomer(orgId, lineUserId, { branchId: defaultBranchId });

      const { runLineClinicReply } = await import("@/lib/line-inbound-ai");
      const { reply: botReply, media: promoMedia } = await runLineClinicReply({
        orgId,
        lineUserId,
        text,
        branchId: defaultBranchId,
      });

      const outbound: LineOutboundMessage[] = [];
      if (botReply.trim()) {
        outbound.push({ type: "text", text: botReply.trim() });
      }
      if (promoMedia?.length) {
        const signed = await Promise.all(
          promoMedia.slice(0, 4).map((u) => toSignedUrlIfFirebaseStorage(u.trim()))
        );
        for (const url of signed) {
          if (url.startsWith("https://")) {
            outbound.push({ type: "image", originalContentUrl: url, previewImageUrl: url });
          }
        }
      }

      if (outbound.length === 0) {
        continue;
      }

      let sent = false;
      if (replyToken && token) {
        const r = await replyLineMessages(token, replyToken, outbound);
        sent = r.ok;
        if (!r.ok) {
          console.warn("[LINE Webhook] reply failed", {
            correlationId,
            status: r.status,
            body: r.body.slice(0, 200),
          });
        }
      }
      if (!sent && token) {
        const p = await pushLineMessages(token, lineUserId, outbound);
        sent = p.ok;
        if (!p.ok) {
          const textOnly = outbound.find((m) => m.type === "text");
          if (textOnly && textOnly.type === "text") {
            const fallback = await pushLineTextMessage(token, lineUserId, textOnly.text);
            sent = fallback.ok;
          }
          if (!sent) {
            console.warn("[LINE Webhook] push failed", {
              correlationId,
              status: p.status,
              body: p.body.slice(0, 200),
            });
            await enqueueLineWebhookRetry({
              orgId,
              lineUserId,
              text,
              branchId: defaultBranchId,
              correlationId,
            });
          }
        }
      }

      await createConversationFeedback({
        org_id: orgId,
        branch_id: defaultBranchId,
        user_id: lineUserId,
        userMessage: text,
        botReply: botReply.trim() || "[รูปโปรโมชัน]",
        source: "line",
        correlation_id: correlationId,
      });
    }
  } catch (err) {
    console.error("[LINE Webhook] processLineWebhookInbound", { correlationId, orgId, err });
  }
}
