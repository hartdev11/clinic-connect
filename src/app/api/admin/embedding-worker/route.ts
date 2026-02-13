/**
 * POST /api/admin/embedding-worker — Phase 2 #23
 * Trigger embedding queue processing (cron/Cloud Tasks)
 */
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { processEmbeddingQueue } from "@/lib/knowledge-brain/embedding-queue";

export const dynamic = "force-dynamic";

export async function POST() {
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
