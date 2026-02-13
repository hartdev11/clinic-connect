/**
 * GET /api/admin/llm-cost
 * Admin only — daily LLM cost สำหรับ org
 */
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { getDailyLLMCost } from "@/lib/llm-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  const cost = await getDailyLLMCost(guard.session.org_id);
  const limit = Number(process.env.MAX_DAILY_LLM_COST_BAHT ?? 0);
  return NextResponse.json({
    dailyCost: cost,
    limit: limit || null,
    percent: limit > 0 ? Math.min(100, (cost / limit) * 100) : null,
  });
}
