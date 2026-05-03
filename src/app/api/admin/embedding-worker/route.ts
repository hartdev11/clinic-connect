/**
 * POST /api/admin/embedding-worker — Phase 2 #23
 * Trigger embedding queue processing (cron/Cloud Tasks).
 * Auth: CRON_SECRET (Vercel cron) or admin session.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getEffectiveUser } from "@/lib/rbac";
import { processEmbeddingQueue } from "@/lib/knowledge-brain/embedding-queue";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expectedCronSecret = process.env.CRON_SECRET?.trim();

  if (expectedCronSecret && cronSecret === expectedCronSecret) {
    try {
      const { processed, failed } = await processEmbeddingQueue();
      return NextResponse.json({ ok: true, processed, failed });
    } catch (err) {
      console.error("POST /api/admin/embedding-worker (cron):", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  }

  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const effective = await getEffectiveUser(session);
  const sessionRole = (session.role ?? "").toLowerCase();
  const effectiveRole = (effective.role ?? "").toLowerCase();
  if (sessionRole !== "platform_admin" && effectiveRole !== "platform_admin") {
    return NextResponse.json({ error: "Forbidden", code: "INSUFFICIENT_ROLE" }, { status: 403 });
  }

  try {
    const { processed, failed } = await processEmbeddingQueue();
    return NextResponse.json({ ok: true, processed, failed });
  } catch (err) {
    console.error("POST /api/admin/embedding-worker:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
