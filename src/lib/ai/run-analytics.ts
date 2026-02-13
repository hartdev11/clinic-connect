/**
 * Run 6 Analytics Agents แบบขนาน
 * รวมผลเป็น AggregatedAnalyticsContext
 * Target: <250ms total (แต่ละตัว <200ms, พร้อมกัน)
 */
import {
  runBookingAgent,
  runPromotionAgent,
  runCustomerAgent,
  runFinanceAgent,
  runKnowledgeAgent,
  runFeedbackAgent,
} from "./agents";
import { log } from "@/lib/logger";
import type { AnalyticsContext } from "./types";
import type { AggregatedAnalyticsContext } from "./types";

export async function runAllAnalytics(
  ctx: AnalyticsContext
): Promise<AggregatedAnalyticsContext> {
  const start = Date.now();

  const [booking, promotion, customer, finance, knowledge, feedback] =
    await Promise.all([
      runBookingAgent(ctx),
      runPromotionAgent(ctx),
      runCustomerAgent(ctx),
      runFinanceAgent(ctx),
      runKnowledgeAgent(ctx),
      runFeedbackAgent(ctx),
    ]);

  const totalAnalyticsMs = Date.now() - start;

  if (process.env.NODE_ENV === "development") {
    log.info("AI Analytics completed", {
      totalAnalyticsMs,
      correlationId: ctx.correlationId,
      org_id: ctx.org_id,
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
    booking,
    promotion,
    customer,
    finance,
    knowledge,
    feedback,
    totalAnalyticsMs,
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
