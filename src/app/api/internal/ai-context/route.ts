/**
 * Internal AI Context API — server-side only (AI agent access)
 * Auth: X-Internal-AI-Context-Key header must match INTERNAL_AI_CONTEXT_SECRET
 * Purpose: Allow AI agents to adjust messaging, push underperforming services, detect gaps
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getAnalyticsOverview,
  getAnalyticsConversation,
  getAnalyticsRevenue,
  getAnalyticsAIPerformance,
  getAnalyticsKnowledge,
  parseAnalyticsRange,
} from "@/lib/analytics-data";
import { getAnalyticsComparison } from "@/lib/analytics-comparison";
import { getAnalyticsAlerts } from "@/lib/analytics-alert-engine";
import { getBranchPerformanceScore } from "@/lib/analytics-scoring";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SECRET_HEADER = "x-internal-ai-context-key";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.INTERNAL_AI_CONTEXT_SECRET?.trim();
  if (!secret) return false;
  const key = request.headers.get(SECRET_HEADER) ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return key === secret;
}

export async function GET(request: NextRequest) {
  return runWithObservability("/api/internal/ai-context", request, async () => {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const orgId = request.nextUrl.searchParams.get("org_id");
    if (!orgId) {
      return NextResponse.json({ error: "org_id required" }, { status: 400 });
    }
    const branchId = request.nextUrl.searchParams.get("branch_id") ?? null;
    const rangeParam = request.nextUrl.searchParams.get("range") ?? "7d";
    const range = parseAnalyticsRange(rangeParam);

  try {
    const [
      overview,
      conversation,
      revenue,
      aiPerf,
      knowledge,
      comparison,
      alerts,
      branchPerformance,
    ] = await Promise.all([
      getAnalyticsOverview(orgId, { branchId, from: range.from, to: range.to }),
      getAnalyticsConversation(orgId, { branchId, from: range.from, to: range.to }),
      getAnalyticsRevenue(orgId, { branchId, from: range.from, to: range.to }),
      getAnalyticsAIPerformance(orgId, { branchId, from: range.from, to: range.to }),
      getAnalyticsKnowledge(orgId, { branchId, from: range.from, to: range.to }),
      getAnalyticsComparison(orgId, { branchId, from: range.from, to: range.to }),
      getAnalyticsAlerts(orgId, { branchId, from: range.from, to: range.to }),
      getBranchPerformanceScore(orgId, { from: range.from, to: range.to }),
    ]);

    const weakServices = revenue.byService
      .filter((s) => s.revenue <= 0 || s.count <= 0)
      .map((s) => s.serviceName)
      .slice(0, 5);
    const lowRevenueServices = revenue.byService
      .sort((a, b) => a.revenue - b.revenue)
      .slice(0, 5)
      .map((s) => ({ name: s.serviceName, revenue: s.revenue, count: s.count }));

    return {
      response: NextResponse.json({
        revenueSummary: {
          total: overview.revenue,
          trend: comparison.revenue.direction,
          percentChange: comparison.revenue.percentChange,
        },
        conversionRate: overview.conversionRate,
        conversionTrend: comparison.conversionRate.direction,
        topIntents: conversation.intentDistribution.slice(0, 8),
        weakServices: weakServices.length > 0 ? weakServices : lowRevenueServices.map((s) => s.name),
        lowRevenueServices,
        branchPerformance: branchPerformance.map((b) => ({
          branchId: b.branchId,
          branchName: b.branchName,
          performanceScore: b.performanceScore,
          status: b.status,
          revenue: b.revenue,
        })),
        alerts: alerts.map((a) => ({ type: a.type, severity: a.severity, message: a.message, recommendation: a.recommendation })),
        growthTrend: {
          revenue: comparison.revenue.percentChange,
          conversion: comparison.conversionRate.percentChange,
          direction: comparison.revenue.direction,
        },
        aiAccuracy: aiPerf.accuracyScore,
        aiAccuracyTrend: comparison.accuracy.direction,
        knowledgeCoverage: {
          activeDocuments: knowledge.activeDocuments,
          totalDocuments: knowledge.totalDocuments,
          coveragePercent: knowledge.coveragePercent ?? 0,
          unansweredCount: knowledge.unansweredCount ?? 0,
        },
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      }),
      orgId,
      branchId,
    };
  } catch (err) {
    console.error("GET /api/internal/ai-context:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}
