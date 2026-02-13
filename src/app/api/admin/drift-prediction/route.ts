/**
 * Phase 3 #4 — Knowledge Decay & Drift Prediction Job
 * POST /api/admin/drift-prediction
 */
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { runDecayPredictionJob } from "@/lib/knowledge-brain";

export const dynamic = "force-dynamic";

export async function POST() {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  try {
    const { marked, notified } = await runDecayPredictionJob();
    return NextResponse.json({ ok: true, marked, notified });
  } catch (err) {
    console.error("POST /api/admin/drift-prediction:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
