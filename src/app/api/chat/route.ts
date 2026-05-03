import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireProxySession } from "@/lib/phase-proxy";
import { createConversationFeedback } from "@/lib/clinic-data";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  const sessionResult = await requireProxySession(request);
  if (!sessionResult.ok) return sessionResult.response;

  const body = await request.json().catch(() => ({}));
  const tenantId = sessionResult.context.tenantId;

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const branchId = typeof body?.branch_id === "string" ? body.branch_id : sessionResult.context.session.branch_id;
  const externalUserId = typeof body?.userId === "string" ? body.userId : null;

  if (!message) {
    return NextResponse.json({ error: "message is required (string)" }, { status: 400 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!anthropicKey) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 503 });
  }
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6";
  let reply = "รับข้อมูลเรียบร้อยแล้ว";
  try {
    const completion = await anthropic.messages.create({
      model,
      max_tokens: 700,
      system:
        "You are a Thai clinic sales assistant. Reply in Thai, concise, helpful, and conversion-focused.",
      messages: [{ role: "user", content: message }],
    });
    const textPart = completion.content.find((part) => part.type === "text");
    if (textPart?.type === "text" && textPart.text.trim()) {
      reply = textPart.text.trim();
    }
  } catch (err) {
    console.error("Anthropic chat failed:", err);
    return NextResponse.json({ error: "Chat service unavailable" }, { status: 503 });
  }

  try {
    await createConversationFeedback({
      org_id: tenantId,
      branch_id: branchId ?? null,
      user_id: externalUserId ?? `web_${sessionResult.context.requestId}`,
      userMessage: message,
      botReply: reply,
      source: "web",
    });
  } catch (err) {
    console.warn("createConversationFeedback failed:", err);
  }

  return NextResponse.json({
    reply,
    success: true,
    meta: {
      offer: null,
      booking_intent: null,
      score: null,
    },
  });
}
