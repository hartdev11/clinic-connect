import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsContext } from "../shared";
import { getConversionAttribution } from "@/lib/analytics-phase21";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/analytics/conversion", request, async () => {
    const result = await getAnalyticsContext(request);
    if ("response" in result) return result.response;
    const { context } = result;
    try {
      const data = await getConversionAttribution(context.orgId, context.branchId);
      return NextResponse.json(data);
    } catch (err) {
      console.error("GET /api/clinic/analytics/conversion:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
