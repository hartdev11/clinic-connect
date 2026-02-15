/**
 * POST /api/admin/promotion-lifecycle
 * Cron: every 5 minutes. Auth: CRON_SECRET or admin session.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { runPromotionLifecycle } from "@/lib/promotion-lifecycle";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expectedCronSecret = process.env.CRON_SECRET?.trim();

  if (expectedCronSecret && cronSecret === expectedCronSecret) {
    const result = await runPromotionLifecycle();
    return NextResponse.json(result);
  }

  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  const result = await runPromotionLifecycle();
  return NextResponse.json(result);
}
