/**
 * Production Health Endpoint
 * GET /api/health
 */
import { NextResponse } from "next/server";
import { isGlobalAIDisabled } from "@/lib/llm-cost-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; message?: string }> = {};
  let status: "ok" | "degraded" = "ok";
  const aiDisabled = isGlobalAIDisabled();
  if (aiDisabled) checks.ai = { ok: false, message: "GLOBAL_AI_DISABLED" };
  else checks.ai = { ok: true };

  try {
    const { db } = await import("@/lib/firebase-admin");
    await db.collection("organizations").limit(1).get();
    checks.firestore = { ok: true };
  } catch (err) {
    checks.firestore = { ok: false, message: (err as Error).message };
    status = "degraded";
  }

  const requiredEnv = [
    "SESSION_SECRET",
    "OPENAI_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ] as const;
  for (const key of requiredEnv) {
    const val = process.env[key];
    checks[key] = val?.trim() ? { ok: true } : { ok: false, message: "not set" };
    if (!val?.trim()) status = "degraded";
  }

  return NextResponse.json({
    status,
    checks,
    timestamp: new Date().toISOString(),
  });
}
