/**
 * POST /api/admin/cleanup
 * Admin only หรือ Vercel Cron (CRON_SECRET)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { runAllCleanup } from "@/lib/background-cleanup";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expectedCronSecret = process.env.CRON_SECRET?.trim();

  if (expectedCronSecret && cronSecret === expectedCronSecret) {
    const result = await runAllCleanup();
    return NextResponse.json(result);
  }

  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  const result = await runAllCleanup();
  return NextResponse.json(result);
}
