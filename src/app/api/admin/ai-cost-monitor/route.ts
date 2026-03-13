/**
 * GET /api/admin/ai-cost-monitor
 * Admin only — list orgs by daily cost, 7-day trend, breakdown by workload.
 * Phase 12: + aggregate pipeline metrics (cache hit rate, tokens saved, cost saved, template count, avg confidence)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { listOrgsWithUsageLast7Days, getOrgIdsWithUsageInRange } from "@/lib/ai-usage-daily";
import { getTodayKeyBangkok, getDateKeyBangkokDaysAgo } from "@/lib/timezone";
import { getAggregatePipelineMetricsForOrgs } from "@/lib/ai-pipeline-metrics";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runWithObservability("/api/admin/ai-cost-monitor", request, async () => {
    const guard = await requireAdminSession();
    if (!guard.ok) return guard.response;

    try {
      const rows = await listOrgsWithUsageLast7Days();
      const today = getTodayKeyBangkok();
      const startDate = getDateKeyBangkokDaysAgo(6);
      const orgIds = await getOrgIdsWithUsageInRange(startDate, today);
      const pipelineMetrics = await getAggregatePipelineMetricsForOrgs(orgIds);

      const metricsList = Object.values(pipelineMetrics);
      const totalTokensSaved = metricsList.reduce((a, b) => a + b.tokensSavedByCache, 0);
      const totalCostSaved = metricsList.reduce((a, b) => a + b.costSavedThb, 0);
      const totalTemplates = metricsList.reduce((a, b) => a + b.templateResponses, 0);
      const avgCacheHitRate =
        metricsList.length > 0
          ? metricsList.reduce((a, b) => a + b.cacheHitRate, 0) / metricsList.length
          : 0;
      const avgConfidence =
        metricsList.length > 0
          ? metricsList.reduce((a, b) => a + b.avgConfidence, 0) / metricsList.length
          : 0;

      return NextResponse.json({
        orgs: rows,
        pipelineMetrics,
        aggregate: {
          cacheHitRate: avgCacheHitRate,
          tokensSavedByCache: totalTokensSaved,
          costSavedThb: totalCostSaved,
          templateResponses: totalTemplates,
          avgConfidence,
        },
        message: "List orgs by 7-day AI cost (sorted by highest usage)",
      });
    } catch (err) {
      console.error("GET /api/admin/ai-cost-monitor:", err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
        { status: 500 }
      );
    }
  });
}
