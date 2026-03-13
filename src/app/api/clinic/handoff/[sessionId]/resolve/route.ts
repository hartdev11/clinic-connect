/**
 * Phase 7 — Resolve handoff session
 * POST: set status resolved, clear aiPaused, send welcome-back message via LINE
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getHandoffSession, resolveHandoffSession } from "@/lib/handoff-data";
import { getLineChannelByOrgId } from "@/lib/line-channel-data";
import { trackSLAResolution } from "@/lib/handoff-sla";

export const dynamic = "force-dynamic";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const WELCOME_BACK_MESSAGE = "กลับมาให้บริการแล้วนะคะ 😊 มีอะไรให้ช่วยไหมคะ?";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const resolutionNotes = typeof body.resolutionNotes === "string" ? body.resolutionNotes.trim() : "";
    const markForLearning = !!body.markForLearning;
    const learningQuality = ["excellent", "good", "poor"].includes(body.learningQuality)
      ? body.learningQuality
      : undefined;
    const excludeIndices = Array.isArray(body.excludeIndices)
      ? (body.excludeIndices as number[]).filter((n) => typeof n === "number" && Number.isInteger(n))
      : undefined;

    const handoff = await getHandoffSession(orgId, sessionId);
    if (!handoff) {
      return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });
    }

    const ok = await resolveHandoffSession(orgId, sessionId, {
      resolutionNotes: resolutionNotes || undefined,
      markForLearning,
      learningQuality,
    });
    if (!ok) {
      return NextResponse.json({ error: "ไม่สามารถปิด session ได้" }, { status: 409 });
    }

    trackSLAResolution(orgId, sessionId).catch((err) =>
      console.warn("[Handoff] trackSLAResolution failed:", (err as Error)?.message)
    );

    if (markForLearning && learningQuality && learningQuality !== "poor") {
      const { triggerHandoffLearning } = await import("@/lib/learning/run-learning");
      const outcome = await triggerHandoffLearning(
        sessionId,
        orgId,
        learningQuality,
        excludeIndices
      );
      if (outcome.result && process.env.NODE_ENV === "development") {
        console.log("[Handoff] Learning completed:", outcome.result);
      }
    }

    let accessToken: string | null = null;
    const channel = await getLineChannelByOrgId(orgId);
    if (channel?.channel_access_token) {
      accessToken = channel.channel_access_token;
    } else if (process.env.LINE_ORG_ID === orgId && process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim()) {
      accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN.trim();
    }
    if (accessToken && handoff.customerLineId) {
      await fetch(LINE_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          to: handoff.customerLineId,
          messages: [{ type: "text", text: WELCOME_BACK_MESSAGE }],
        }),
      }).catch((e) => console.error("[Handoff] Welcome-back LINE push failed:", e));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/clinic/handoff/[sessionId]/resolve:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
