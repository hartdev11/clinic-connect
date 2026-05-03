import { NextRequest, NextResponse } from "next/server";
import { requireProxySession } from "@/lib/phase-proxy";
import { getLast7DaysUsage } from "@/lib/ai-usage-daily";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionResult = await requireProxySession(request);
  if (!sessionResult.ok) return sessionResult.response;
  const orgId = sessionResult.context.tenantId;
  const daily = await getLast7DaysUsage(orgId);
  const totalCost7d = daily.reduce((sum, d) => sum + (d.totalCost ?? 0), 0);
  const totalTokens7d = daily.reduce((sum, d) => {
    const byType = d.byWorkloadType ?? {};
    const subtotal = Object.values(byType).reduce((s, row) => s + Number(row.tokens ?? 0), 0);
    return sum + subtotal;
  }, 0);
  return NextResponse.json({
    org_id: orgId,
    total_cost_7d: totalCost7d,
    total_tokens_7d: totalTokens7d,
    average_cost_per_day: totalCost7d / 7,
  });
}
