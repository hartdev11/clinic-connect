import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsContext } from "../shared";
import { getBranchPerformanceScore } from "@/lib/analytics-scoring";
import { getEffectiveUser } from "@/lib/rbac";
import { analyticsCacheKey, getAnalyticsCached, setAnalyticsCached } from "@/lib/analytics-cache";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

/**
 * Owner: sees all branches ranked.
 * Manager: sees only branches they have access to (filter by branch_ids / branch_roles).
 */
export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/analytics/branch-performance", request, async () => {
    const result = await getAnalyticsContext(request);
    if ("response" in result) return result.response;
    const { context } = result;
    const fromIso = context.range.from.toISOString();
    const toIso = context.range.to.toISOString();
    const cacheKey = analyticsCacheKey("branch-performance", [context.orgId, fromIso, toIso]);
    try {
      const session = await (await import("@/lib/auth-session")).getSessionFromCookies();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const user = await getEffectiveUser(session);
      let allScores = await getAnalyticsCached<Awaited<ReturnType<typeof getBranchPerformanceScore>>>(cacheKey);
      if (!allScores) {
        allScores = await getBranchPerformanceScore(context.orgId, {
          from: context.range.from,
          to: context.range.to,
        });
        await setAnalyticsCached(cacheKey, allScores);
      }
      let scores = allScores;
      if (user.role !== "owner") {
        const allowedBranchIds =
          user.branch_ids && user.branch_ids.length > 0
            ? user.branch_ids
            : user.branch_roles
              ? Object.keys(user.branch_roles)
              : [];
        if (allowedBranchIds.length > 0) {
          scores = allScores.filter((s) => allowedBranchIds.includes(s.branchId));
        }
      }
      return {
        response: NextResponse.json({
          branches: scores,
          from: context.range.from.toISOString(),
          to: context.range.to.toISOString(),
          preset: context.range.preset,
        }),
        orgId: context.orgId,
        branchId: context.branchId,
      };
    } catch (err) {
      console.error("GET /api/clinic/analytics/branch-performance:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
