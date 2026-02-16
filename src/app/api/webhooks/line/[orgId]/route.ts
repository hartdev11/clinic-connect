/**
 * LINE Webhook — Multi-tenant
 * POST /api/webhooks/line/[orgId]
 * คลินิกตั้ง Webhook URL = https://domain/api/webhooks/line/{orgId}
 * Verify ด้วย org นั้น ๆ channel_secret
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyLineSignature, parseLineWebhook } from "@/lib/line-webhook";
import { chatAgentReply } from "@/lib/chat-agent";
import { runPipeline } from "@/lib/agents/pipeline";
import { composeSafeFallbackMessage } from "@/lib/agents/safe-fallback";
import {
  createConversationFeedback,
  getSubscriptionByOrgId,
  upsertLineCustomer,
} from "@/lib/clinic-data";
import { getLineChannelByOrgId } from "@/lib/line-channel-data";
import { usePipeline, use7AgentChat } from "@/lib/feature-flags";
import { chatOrchestrate } from "@/lib/ai/orchestrator";
import { toSignedUrlsForLine } from "@/lib/promotion-storage";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const LINE_MAX_TEXT_LENGTH = 5000;

function truncateForLine(text: string): string {
  if (text.length <= LINE_MAX_TEXT_LENGTH) return text;
  return text.slice(0, LINE_MAX_TEXT_LENGTH - 3) + "...";
}

type LineMessage = { type: "text"; text: string } | { type: "image"; originalContentUrl: string; previewImageUrl: string } | { type: "video"; originalContentUrl: string; previewImageUrl: string };

async function sendLineReply(
  replyToken: string,
  text: string,
  accessToken: string,
  mediaUrls?: string[]
): Promise<boolean> {
  const safeText = truncateForLine(text);
  const messages: LineMessage[] = [{ type: "text", text: safeText }];
  if (mediaUrls && mediaUrls.length > 0) {
    for (const url of mediaUrls.slice(0, 4)) {
      const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(url) || /video/i.test(url);
      if (isVideo) {
        messages.push({ type: "video", originalContentUrl: url, previewImageUrl: url });
      } else {
        messages.push({ type: "image", originalContentUrl: url, previewImageUrl: url });
      }
    }
  }
  try {
    const res = await fetch(LINE_REPLY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ replyToken, messages }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[LINE Reply] API error:", res.status, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[LINE Reply] Error:", err);
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  if (!orgId) {
    return new NextResponse("Missing orgId", { status: 400 });
  }

  const channel = await getLineChannelByOrgId(orgId);
  if (!channel) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[LINE Webhook] No line_channel for org:", orgId);
    }
    return new NextResponse("OK", { status: 200 }); // LINE expects 200
  }

  const channelSecret = channel.channel_secret;
  const channelToken = channel.channel_access_token;
  const signature = request.headers.get("x-line-signature") ?? "";
  const isDevelopment = process.env.NODE_ENV === "development";

  let body: string;
  try {
    body = await request.text();
  } catch (err) {
    console.error("[LINE Webhook] Read body error:", err);
    return new NextResponse("Error", { status: 500 });
  }

  if (channelSecret) {
    if (signature && !verifyLineSignature(body, signature, channelSecret)) {
      if (!isDevelopment) {
        console.warn("[LINE Webhook] Invalid signature for org:", orgId);
        return new NextResponse("Forbidden", { status: 403 });
      }
    } else if (!signature && !isDevelopment) {
      console.warn("[LINE Webhook] Missing signature");
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const parsed = parseLineWebhook(body);
  const events = parsed.events ?? [];

  let messageProcessed = false;
  for (const event of events) {
    if (event.type !== "message" || event.message?.type !== "text") continue;
    const replyToken = event.replyToken;
    const userText = event.message.text?.trim();
    if (!replyToken || !userText) continue;
    messageProcessed = true;

    const userId = event.source?.userId || undefined;

    void (async () => {
      try {
        let replyText: string;
        let intent: { intent?: string; service?: string; area?: string } | undefined;
        let correlationId: string | undefined;

        const shouldUse7Agent = use7AgentChat();
        const shouldUsePipeline = usePipeline();

        let mediaUrls: string[] | undefined;
        if (shouldUse7Agent) {
          const result = await chatOrchestrate({
            message: userText,
            org_id: orgId,
            branch_id: null,
            userId: userId ?? null,
            channel: "line",
          });
          replyText = result.reply?.trim() || "";
          mediaUrls = result.media;
          intent = { intent: "general_chat" };
          correlationId = result.correlationId;
        } else if (shouldUsePipeline) {
          let subscriptionPlan: string | undefined;
          try {
            const sub = await getSubscriptionByOrgId(orgId);
            subscriptionPlan = sub?.plan;
          } catch {
            /* ignore */
          }
          const result = await runPipeline(userText, userId, undefined, {
            org_id: orgId,
            branch_id: undefined,
            role: undefined,
            subscriptionPlan,
            channel: "line",
          });
          replyText = result.reply?.trim() || "";
          intent = result.intent ?? undefined;
          if (result.media && result.media.length > 0) mediaUrls = result.media;
        } else {
          replyText = (await chatAgentReply(userText))?.trim() || "";
        }

        const finalText = replyText || composeSafeFallbackMessage();
        const lineMediaUrls = mediaUrls && mediaUrls.length > 0 ? await toSignedUrlsForLine(mediaUrls) : undefined;
        const ok = await sendLineReply(replyToken, finalText, channelToken, lineMediaUrls);
        if (isDevelopment) {
          console.log("[LINE Webhook]", orgId, "Reply sent:", ok ? "OK" : "FAIL");
        }

        if (finalText) {
          if (userId) {
            upsertLineCustomer(orgId, userId).catch((err) => {
              if (isDevelopment) {
                console.warn("[LINE Webhook] upsertLineCustomer error:", (err as Error)?.message?.slice(0, 60));
              }
            });
          }
          createConversationFeedback({
            org_id: orgId,
            user_id: userId ?? null,
            userMessage: userText,
            botReply: finalText,
            intent: intent?.intent ?? null,
            service: intent?.service ?? null,
            area: intent?.area ?? null,
            source: "line",
            correlation_id: correlationId ?? null,
          }).catch((err) => {
            if (isDevelopment) {
              console.warn("[LINE Webhook] Feedback error:", (err as Error)?.message?.slice(0, 60));
            }
          });
        }
      } catch (err) {
        console.error("[LINE Webhook] Reply error:", err);
        await sendLineReply(replyToken, composeSafeFallbackMessage(), channelToken);
      }
    })();
  }

  return new NextResponse("OK", { status: 200 });
}
