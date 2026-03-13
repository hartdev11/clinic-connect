/**
 * Run Analytics Agents แบบขนาน
 * Phase 6: 6 base + 4 specialized (sales, followup, objection, referral)
 * รวมผลเป็น AggregatedAnalyticsContext
 * Target: <350ms total
 */
import {
  runBookingAgent,
  runPromotionAgent,
  runCustomerAgent,
  runFinanceAgent,
  runKnowledgeAgent,
  runFeedbackAgent,
  runSalesAgent,
  runFollowupAgent,
  runObjectionHandlerAgent,
  runReferralAgent,
  runManagerRouting,
} from "./agents";
import { log } from "@/lib/logger";
import type { AnalyticsContext } from "./types";
import type { AggregatedAnalyticsContext } from "./types";

export async function runAllAnalytics(
  ctx: AnalyticsContext
): Promise<AggregatedAnalyticsContext> {
  const start = Date.now();

  const [
    booking,
    promotion,
    customer,
    finance,
    knowledge,
    feedback,
    sales,
    followup,
    objection,
    referral,
  ] = await Promise.all([
    runBookingAgent(ctx),
    runPromotionAgent(ctx),
    runCustomerAgent(ctx),
    runFinanceAgent(ctx),
    runKnowledgeAgent(ctx),
    runFeedbackAgent(ctx),
    runSalesAgent(ctx),
    runFollowupAgent(ctx),
    runObjectionHandlerAgent(ctx),
    runReferralAgent(ctx),
  ]);

  const totalAnalyticsMs = Date.now() - start;
  const aggregated: AggregatedAnalyticsContext = {
    booking,
    promotion,
    customer,
    finance,
    knowledge,
    feedback,
    sales,
    followup,
    objection,
    referral,
    totalAnalyticsMs,
  };

  const managerRouting = runManagerRouting(ctx.userMessage ?? "", aggregated);
  aggregated._managerRoute = managerRouting.primaryAgent;

  if (process.env.NODE_ENV === "development") {
    log.info("AI Analytics completed", {
      totalAnalyticsMs,
      correlationId: ctx.correlationId,
      org_id: ctx.org_id,
      managerRoute: managerRouting.primaryAgent,
    });
  }

  const knowledgeExtended = knowledge as {
    _retrievalConfidence?: number;
    _lowConfidence?: boolean;
    _knowledgeSource?: string;
    _knowledgeVersion?: number;
    _knowledgeQualityScore?: number;
    _knowledgeCategory?: string;
    _retrievalKnowledgeIds?: string[];
    _retrievalMode?: "full" | "restricted" | "abstain";
  };

  return {
    ...aggregated,
    _retrievalConfidence: knowledgeExtended._retrievalConfidence,
    _lowConfidence: knowledgeExtended._lowConfidence,
    _retrievalMode: knowledgeExtended._retrievalMode,
    _knowledgeSource: knowledgeExtended._knowledgeSource,
    _knowledgeVersion: knowledgeExtended._knowledgeVersion,
    _knowledgeQualityScore: knowledgeExtended._knowledgeQualityScore,
    _knowledgeCategory: knowledgeExtended._knowledgeCategory,
    _retrievalKnowledgeIds: knowledgeExtended._retrievalKnowledgeIds,
  };
}
