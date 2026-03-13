/**
 * POST /api/admin/retrain-monitor
 * Phase 6: Daily cron at 6 AM — ตรวจสอบเงื่อนไข Retrain
 * Vercel Cron หรือ CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { runRetrainMonitor } from "@/lib/ai/retrain-monitor";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expectedCronSecret = process.env.CRON_SECRET?.trim();

  if (expectedCronSecret && cronSecret === expectedCronSecret) {
    const result = await runRetrainMonitor();
    return NextResponse.json(result);
  }

  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  const result = await runRetrainMonitor();
  return NextResponse.json(result);
}
