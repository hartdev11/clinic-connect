/**
 * Branch Intelligence Scoring — 0–100 composite score per branch
 * Weights: Revenue 40%, Growth 20%, Conversion 20%, AI Close 10%, Escalation 10%
 */
import { getBranchesByOrgId } from "@/lib/clinic-data";
import { getAnalyticsOverview } from "@/lib/analytics-data";
import { getRevenueFromPaidInvoices } from "@/lib/financial-data";

export type BranchPerformanceStatus = "Strong" | "Monitor" | "Critical";

export interface BranchPerformanceScore {
  branchId: string;
  branchName: string;
  revenue: number;
  growthPercent: number;
  conversionRate: number;
  aiCloseRate: number;
  escalationRate: number;
  performanceScore: number; // 0–100
  status: BranchPerformanceStatus;
}

const REVENUE_WEIGHT = 0.4;
const GROWTH_WEIGHT = 0.2;
const CONVERSION_WEIGHT = 0.2;
const AI_CLOSE_WEIGHT = 0.1;
const ESCALATION_WEIGHT = 0.1;

/** Normalize value to 0–100 given a reasonable max (e.g. revenue in baht, rates in %) */
function normRevenue(maxRevenue: number, revenue: number): number {
  if (maxRevenue <= 0) return 0;
  return Math.min(100, (revenue / maxRevenue) * 100);
}

function normRate(rate: number): number {
  return Math.min(100, Math.max(0, rate));
}

/**
 * Compute branch performance score for each branch of org.
 * Growth % = (current revenue - previous period revenue) / previous * 100.
 */
export async function getBranchPerformanceScore(
  orgId: string,
  opts: { from: Date; to: Date }
): Promise<BranchPerformanceScore[]> {
  const branches = await getBranchesByOrgId(orgId);
  if (branches.length === 0) return [];

  const periodMs = opts.to.getTime() - opts.from.getTime();
  const prevTo = new Date(opts.from.getTime() - 1);
  prevTo.setHours(23, 59, 59, 999);
  const prevFrom = new Date(prevTo.getTime() - periodMs);
  prevFrom.setHours(0, 0, 0, 0);

  const results: BranchPerformanceScore[] = await Promise.all(
    branches.map(async (branch) => {
      const [current, prevRevenue] = await Promise.all([
        getAnalyticsOverview(orgId, {
          branchId: branch.id,
          from: opts.from,
          to: opts.to,
        }),
        getRevenueFromPaidInvoices(orgId, {
          branchId: branch.id,
          from: prevFrom,
          to: prevTo,
        }),
      ]);
      const growthPercent =
        prevRevenue > 0
          ? Math.round(((current.revenue - prevRevenue) / prevRevenue) * 10000) / 100
          : current.revenue > 0 ? 100 : 0;

      return {
        branchId: branch.id,
        branchName: branch.name,
        revenue: current.revenue,
        growthPercent,
        conversionRate: current.conversionRate,
        aiCloseRate: current.aiCloseRate,
        escalationRate: current.escalationRate,
        performanceScore: 0, // computed below after we have maxRevenue
        status: "Monitor",
      };
    })
  );

  const maxRevenue = Math.max(1, ...results.map((r) => r.revenue));
  for (const r of results) {
    const revScore = normRevenue(maxRevenue, r.revenue);
    const growthScore = Math.min(100, Math.max(0, 50 + r.growthPercent)); // 0% -> 50, +50% -> 100
    const convScore = normRate(r.conversionRate);
    const aiScore = normRate(r.aiCloseRate);
    const escScore = 100 - normRate(r.escalationRate); // lower escalation = higher score
    r.performanceScore = Math.round(
      revScore * REVENUE_WEIGHT +
        growthScore * GROWTH_WEIGHT +
        convScore * CONVERSION_WEIGHT +
        aiScore * AI_CLOSE_WEIGHT +
        escScore * ESCALATION_WEIGHT
    );
    r.performanceScore = Math.min(100, Math.max(0, r.performanceScore));
    r.status =
      r.performanceScore >= 70 ? "Strong" : r.performanceScore >= 40 ? "Monitor" : "Critical";
  }

  results.sort((a, b) => b.performanceScore - a.performanceScore);
  return results;
}
