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
import {
  isLineEventProcessed,
  markLineEventProcessed,
  getMessageHash,
} from "@/lib/line-idempotency";
import { checkOrSetIdempotency, setLineEventReply } from "@/lib/idempotency";
import { usePipeline, use7AgentChat } from "@/lib/feature-flags";
import { chatOrchestrate } from "@/lib/ai/orchestrator";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
/** LINE จำกัดข้อความต่อ 1 message ไม่เกิน 5,000 ตัวอักษร */
const LINE_MAX_TEXT_LENGTH = 5000;

function truncateForLine(text: string): string {
  if (text.length <= LINE_MAX_TEXT_LENGTH) return text;
  return text.slice(0, LINE_MAX_TEXT_LENGTH - 3) + "...";
}

async function sendLineReply(
  replyToken: string,
  text: string,
  accessToken: string
): Promise<boolean> {
  const safeText = truncateForLine(text);
  try {
    const res = await fetch(LINE_REPLY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text: safeText }],
      }),
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

export async function POST(request: NextRequest) {
  console.log("[LINE Webhook] POST received");
  const channelSecret = process.env.LINE_CHANNEL_SECRET?.trim();
  const channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  const signature = request.headers.get("x-line-signature") ?? "";
  const isDevelopment = process.env.NODE_ENV === "development";

  let body: string;
  try {
    body = await request.text();
  } catch (err) {
    console.error("[LINE Webhook] Read body error:", err);
    return new NextResponse("Error", { status: 500 });
  }

  // Debug logging ใน development mode
  if (isDevelopment) {
    console.log("[LINE Webhook] Debug info:", {
      hasChannelSecret: !!channelSecret,
      hasSignature: !!signature,
      bodyLength: body.length,
      bodyPreview: body.slice(0, 200),
    });
  }

  // ✅ ใน development mode: ถ้าไม่มี signature หรือ verify ไม่ผ่าน → skip verification
  // (เพราะ LINE webhook อาจส่งมาจาก production URL แต่เรารับที่ local)
  // ⚠️ ใน production: ต้อง verify signature เสมอ
  if (channelSecret) {
    if (signature && !verifyLineSignature(body, signature, channelSecret)) {
      if (isDevelopment) {
        console.warn("[LINE Webhook] Invalid signature (skipping in dev mode)");
        // ใน development mode: ยังให้ผ่านต่อ (เพื่อทดสอบ)
      } else {
        console.warn("[LINE Webhook] Invalid signature");
        return new NextResponse("Forbidden", { status: 403 });
      }
    } else if (!signature && !isDevelopment) {
      // ใน production: ถ้าไม่มี signature → reject
      console.warn("[LINE Webhook] Missing signature");
      return new NextResponse("Forbidden", { status: 403 });
    }
  } else if (!isDevelopment) {
    // ใน production: ถ้าไม่มี channel secret → reject
    console.warn("[LINE Webhook] Missing channel secret");
    return new NextResponse("Forbidden", { status: 403 });
  }

  const parsed = parseLineWebhook(body);
  const events = parsed.events ?? [];
  console.log("[LINE Webhook] Events count:", events.length);
  if (events.length > 0) {
    console.log(
      "[LINE Webhook] Events:",
      events.map((e) => ({ type: e.type, msgType: e.message?.type }))
    );
  }

  let messageProcessed = false;
  for (const event of events) {
    if (event.type !== "message" || event.message?.type !== "text") continue;
    const replyToken = event.replyToken;
    const userText = event.message.text?.trim();
    const userId = event.source?.userId || "";
    if (!replyToken || !userText) continue;

    const { duplicate } = await checkOrSetIdempotency(replyToken);
    if (duplicate) return new NextResponse("OK", { status: 200 });

    const msgHash = getMessageHash(userText);
    if (await isLineEventProcessed(replyToken, userId, msgHash)) continue;
    await markLineEventProcessed(replyToken, userId, msgHash).catch(() => {});
    messageProcessed = true;

    const token = channelToken;
    console.log("[LINE Webhook] Received message:", userText.slice(0, 60));
    if (userId && process.env.NODE_ENV === "development") {
      console.log("[LINE Webhook] User ID:", userId.slice(0, 10) + "...");
    }
    const shouldUse7Agent = use7AgentChat();
    const shouldUsePipeline = usePipeline();
    const lineOrgId = process.env.LINE_ORG_ID?.trim() || null;

    void (async () => {
      try {
        let replyText: string;
        let intent: { intent?: string; service?: string; area?: string } | undefined;

        if (shouldUse7Agent && lineOrgId) {
          // 7-Agent System: 1 Role Manager + 6 Analytics (1 LLM call)
          const result = await chatOrchestrate({
            message: userText,
            org_id: lineOrgId,
            branch_id: null,
            userId: userId ?? null,
          });
          replyText = result.reply?.trim() || "";
          intent = { intent: "general_chat" };
        } else if (shouldUsePipeline) {
          // FE-5 — ดึง subscription plan สำหรับ context
          let subscriptionPlan: string | undefined;
          if (lineOrgId) {
            try {
              const subscription = await getSubscriptionByOrgId(lineOrgId);
              subscriptionPlan = subscription?.plan;
            } catch (err) {
              if (process.env.NODE_ENV === "development") {
                console.warn("[LINE Webhook] Failed to fetch subscription:", (err as Error)?.message?.slice(0, 60));
              }
            }
          }
          const result = await runPipeline(userText, userId, undefined, {
            org_id: lineOrgId ?? undefined,
            branch_id: undefined,
            role: undefined,
            subscriptionPlan,
            channel: "line",
          });
          replyText = result.reply?.trim() || "";
          intent = result.intent ?? undefined;
        } else {
          replyText = (await chatAgentReply(userText))?.trim() || "";
        }
        const finalText = replyText || composeSafeFallbackMessage();
        if (token) {
          const ok = await sendLineReply(replyToken, finalText, token);
          console.log("[LINE Webhook] Reply sent:", ok ? "OK" : "FAIL");
          setLineEventReply(replyToken, JSON.stringify({ text: finalText })).catch(() => {});
        } else if (process.env.NODE_ENV === "development") {
          console.log("[LINE Webhook] Would reply:", finalText.slice(0, 80));
        }
        // E5.1 — save conversation_feedback (fire-and-forget)
        if (lineOrgId && finalText) {
          if (userId) {
            upsertLineCustomer(lineOrgId, userId).catch((err) => {
              if (process.env.NODE_ENV === "development") {
                console.warn("[LINE Webhook] upsertLineCustomer error:", (err as Error)?.message?.slice(0, 60));
              }
            });
          }
          createConversationFeedback({
            org_id: lineOrgId,
            user_id: userId ?? null,
            userMessage: userText,
            botReply: finalText,
            intent: intent?.intent ?? null,
            service: intent?.service ?? null,
            area: intent?.area ?? null,
            source: "line",
          }).catch((err) => {
            if (process.env.NODE_ENV === "development") {
              console.warn("[LINE Webhook] Feedback save error:", (err as Error)?.message?.slice(0, 60));
            }
          });
        }
      } catch (err) {
        console.error("[LINE Webhook] Background reply error:", err);
        if (token) {
          await sendLineReply(replyToken, composeSafeFallbackMessage(), token);
        }
      }
    })();
  }
  if (events.length > 0 && !messageProcessed) {
    console.log("[LINE Webhook] No text message in events (skipped)");
  }

  return new NextResponse("OK", { status: 200 });
}
