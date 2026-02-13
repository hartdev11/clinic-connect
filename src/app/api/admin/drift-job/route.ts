/**
 * POST /api/admin/drift-job — Phase 2 #15
 * Trigger drift expiry job (cron or manual)
 */
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { runDriftExpiryJob } from "@/lib/knowledge-brain";

export const dynamic = "force-dynamic";

export async function POST() {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  try {
    const { updated } = await runDriftExpiryJob();
    return NextResponse.json({ ok: true, updated });
  } catch (err) {
    console.error("POST /api/admin/drift-job:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
