/**
 * Comparative Intelligence — current vs previous equal-length period (MoM-style)
 */
import { getAnalyticsOverview, getAnalyticsAIPerformance } from "@/lib/analytics-data";

export type TrendDirection = "up" | "down" | "flat";

export interface MetricComparison {
  current: number;
  previous: number;
  percentChange: number;
  direction: TrendDirection;
}

export interface AnalyticsComparison {
  revenue: MetricComparison;
  conversionRate: MetricComparison;
  aiCloseRate: MetricComparison;
  escalationRate: MetricComparison;
  accuracy: MetricComparison;
  totalChats: { current: number; previous: number };
  totalBookings: { current: number; previous: number };
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
}

function toMetricComparison(
  current: number,
  previous: number
): MetricComparison {
  const prevSafe = previous === 0 ? (current === 0 ? 1 : current) : previous;
  const percentChange = Math.round(((current - previous) / prevSafe) * 10000) / 100;
  let direction: TrendDirection = "flat";
  if (percentChange > 0) direction = "up";
  else if (percentChange < 0) direction = "down";
  return {
    current,
    previous,
    percentChange,
    direction,
  };
}

/**
 * Compute current period and previous equal-length period metrics; return comparisons.
 */
export async function getAnalyticsComparison(
  orgId: string,
  opts: { branchId?: string | null; from: Date; to: Date }
): Promise<AnalyticsComparison> {
  const periodMs = opts.to.getTime() - opts.from.getTime();
  const prevTo = new Date(opts.from.getTime() - 1);
  prevTo.setHours(23, 59, 59, 999);
  const prevFrom = new Date(prevTo.getTime() - periodMs);
  prevFrom.setHours(0, 0, 0, 0);

  const [currentOverview, previousOverview, currentAI, previousAI] = await Promise.all([
    getAnalyticsOverview(orgId, { branchId: opts.branchId, from: opts.from, to: opts.to }),
    getAnalyticsOverview(orgId, { branchId: opts.branchId, from: prevFrom, to: prevTo }),
    getAnalyticsAIPerformance(orgId, { branchId: opts.branchId, from: opts.from, to: opts.to }),
    getAnalyticsAIPerformance(orgId, { branchId: opts.branchId, from: prevFrom, to: prevTo }),
  ]);

  return {
    revenue: toMetricComparison(currentOverview.revenue, previousOverview.revenue),
    conversionRate: toMetricComparison(
      currentOverview.conversionRate,
      previousOverview.conversionRate
    ),
    aiCloseRate: toMetricComparison(
      currentOverview.aiCloseRate,
      previousOverview.aiCloseRate
    ),
    escalationRate: toMetricComparison(
      currentOverview.escalationRate,
      previousOverview.escalationRate
    ),
    accuracy: toMetricComparison(currentAI.accuracyScore, previousAI.accuracyScore),
    totalChats: { current: currentOverview.totalChats, previous: previousOverview.totalChats },
    totalBookings: {
      current: currentOverview.totalBookings,
      previous: previousOverview.totalBookings,
    },
    from: opts.from.toISOString(),
    to: opts.to.toISOString(),
    previousFrom: prevFrom.toISOString(),
    previousTo: prevTo.toISOString(),
  };
}
