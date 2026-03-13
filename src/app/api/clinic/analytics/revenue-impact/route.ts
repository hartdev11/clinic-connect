import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsContext } from "../shared";
import { getRevenueImpactData } from "@/lib/analytics-phase21";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/analytics/revenue-impact", request, async () => {
    const result = await getAnalyticsContext(request);
    if ("response" in result) return result.response;
    const { context } = result;
    const daysParam = request.nextUrl.searchParams.get("days");
    const days = daysParam ? Math.min(90, Math.max(7, parseInt(daysParam, 10))) : 30;
    try {
      const data = await getRevenueImpactData(context.orgId, {
        branchId: context.branchId,
        days,
      });
      return NextResponse.json({ data });
    } catch (err) {
      console.error("GET /api/clinic/analytics/revenue-impact:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
