/**
 * POST /api/admin/embedding-worker — Phase 2 #23
 * Trigger embedding queue processing (cron/Cloud Tasks).
 * Auth: CRON_SECRET (Vercel cron) or admin session.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
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

  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

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
