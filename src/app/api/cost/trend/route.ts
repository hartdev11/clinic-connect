import { NextRequest, NextResponse } from "next/server";
import { requireProxySession } from "@/lib/phase-proxy";
import { getLast7DaysUsage } from "@/lib/ai-usage-daily";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionResult = await requireProxySession(request);
  if (!sessionResult.ok) return sessionResult.response;
  const orgId = sessionResult.context.tenantId;
  const daily = await getLast7DaysUsage(orgId);
  const trend = daily.map((d) => ({
    date: d.date,
    totalCost: d.totalCost,
    totalTokens: Object.values(d.byWorkloadType ?? {}).reduce((sum, row) => sum + Number(row.tokens ?? 0), 0),
  }));
  return NextResponse.json({ org_id: orgId, trend });
}
