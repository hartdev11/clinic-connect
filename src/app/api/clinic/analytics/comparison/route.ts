import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsContext } from "../shared";
import { getAnalyticsComparison } from "@/lib/analytics-comparison";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/analytics/comparison", request, async () => {
    const result = await getAnalyticsContext(request);
    if ("response" in result) return result.response;
    const { context } = result;
    try {
      const data = await getAnalyticsComparison(context.orgId, {
        branchId: context.branchId,
        from: context.range.from,
        to: context.range.to,
      });
      return {
        response: NextResponse.json(data),
        orgId: context.orgId,
        branchId: context.branchId,
      };
    } catch (err) {
      console.error("GET /api/clinic/analytics/comparison:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
