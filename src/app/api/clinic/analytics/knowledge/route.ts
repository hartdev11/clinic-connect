import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsContext } from "../shared";
import { getAnalyticsKnowledge } from "@/lib/analytics-data";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/analytics/knowledge", request, async () => {
    const result = await getAnalyticsContext(request);
    if ("response" in result) return result.response;
    const { context } = result;
    try {
      const data = await getAnalyticsKnowledge(context.orgId, {
        branchId: context.branchId ?? undefined,
        from: context.range.from,
        to: context.range.to,
      });
      return {
        response: NextResponse.json(data),
        orgId: context.orgId,
        branchId: context.branchId,
      };
    } catch (err) {
      console.error("GET /api/clinic/analytics/knowledge:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
