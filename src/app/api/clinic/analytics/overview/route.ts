import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsContext } from "../shared";
import { getAnalyticsOverview } from "@/lib/analytics-data";
import { analyticsCacheKey, getAnalyticsCached, setAnalyticsCached } from "@/lib/analytics-cache";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/analytics/overview", request, async () => {
    const result = await getAnalyticsContext(request);
    if ("response" in result) return result.response;
    const { context } = result;
    const fromIso = context.range.from.toISOString();
    const toIso = context.range.to.toISOString();
    const cacheKey = analyticsCacheKey("overview", [
      context.orgId,
      context.branchId ?? "",
      fromIso,
      toIso,
    ]);
    try {
      const cached = await getAnalyticsCached<Record<string, unknown>>(cacheKey);
      if (cached) {
        return {
          response: NextResponse.json({
            ...cached,
            from: fromIso,
            to: toIso,
            preset: context.range.preset,
          }),
          orgId: context.orgId,
          branchId: context.branchId,
        };
      }
      const data = await getAnalyticsOverview(context.orgId, {
        branchId: context.branchId,
        from: context.range.from,
        to: context.range.to,
      });
      const payload = { ...data, from: fromIso, to: toIso, preset: context.range.preset };
      await setAnalyticsCached(cacheKey, data);
      return {
        response: NextResponse.json(payload),
        orgId: context.orgId,
        branchId: context.branchId,
      };
    } catch (err) {
      console.error("GET /api/clinic/analytics/overview:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
