/**
 * Promotion Analytics Agent — AI-native, zero manual assignment.
 * Semantic search when user asks "โปรจมูกมีอะไรบ้าง", "มีโปรฟิลเลอร์ไหม", etc.
 * All 6 agents participate; no admin-configured agent selection.
 */
import { getActivePromotionsForAI } from "@/lib/clinic-data";
import { searchPromotionsBySemantic } from "@/lib/promotion-embedding";
import type { AnalyticsAgentOutput, AnalyticsContext } from "../types";
import type { PromotionDetailForAI } from "../types";

const AGENT_NAME = "promotion-agent";
const TIMEOUT_MS = 220;
const EXPIRING_DAYS_MS = 3 * 86400000;

export async function runPromotionAgent(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const start = Date.now();

  try {
    const timeoutPromise = new Promise<AnalyticsAgentOutput>((_, reject) =>
      setTimeout(() => reject(new Error("Promotion agent timeout")), TIMEOUT_MS)
    );

    const result = await Promise.race([
      executePromotionAnalytics(ctx),
      timeoutPromise,
    ]);

    const elapsed = Date.now() - start;
    if (process.env.NODE_ENV === "development") {
      console.log(`[${AGENT_NAME}] completed in ${elapsed}ms`);
    }
    return result;
  } catch (err) {
    const msg = (err as Error)?.message ?? "Unknown error";
    if (process.env.NODE_ENV === "development") {
      console.warn(`[${AGENT_NAME}] error:`, msg.slice(0, 80));
    }
    return {
      keyFindings: [],
      recommendation: null,
      riskFlags: ["PROMOTION_DATA_UNAVAILABLE"],
    };
  }
}

async function executePromotionAnalytics(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const { org_id, branch_id, userMessage } = ctx;
  const queryText = (userMessage ?? "").trim();
  const now = Date.now();
  const expiringThreshold = now + EXPIRING_DAYS_MS;

  let promotions: Array<{ promotion: import("@/types/clinic").Promotion; score?: number }>;
  if (queryText.length >= 2) {
    const hits = await searchPromotionsBySemantic(org_id, queryText, {
      branchId: branch_id ?? undefined,
      topK: 8,
    });
    promotions = hits.map((h) => ({ promotion: h.promotion, score: h.score }));
    if (promotions.length === 0) {
      const fallback = await getActivePromotionsForAI(org_id, {
        branchId: branch_id ?? undefined,
        limit: 8,
      });
      promotions = fallback.map((p) => ({ promotion: p }));
    }
  } else {
    const list = await getActivePromotionsForAI(org_id, {
      branchId: branch_id ?? undefined,
      limit: 8,
    });
    promotions = list.map((p) => ({ promotion: p }));
  }

  const keyFindings: string[] = [];
  const riskFlags: string[] = [];
  let recommendation: string | null = null;
  const promotionDetails: PromotionDetailForAI[] = [];

  for (const { promotion: p, score } of promotions.slice(0, 8)) {
    keyFindings.push(`promo:${p.name}|target:${p.targetGroup}${score != null ? `|score:${score.toFixed(2)}` : ""}`);
    const endAtMs = p.endAt ? new Date(p.endAt).getTime() : 0;
    const urgency = p.endAt && endAtMs > 0 && endAtMs <= expiringThreshold;
    promotionDetails.push({
      name: p.name,
      aiSummary: p.aiSummary,
      endAt: p.endAt,
      media: p.media.map((m) => m.url).filter(Boolean),
      urgency: urgency || undefined,
    });
  }

  if (promotions.length === 0) {
    riskFlags.push("NO_ACTIVE_PROMOTIONS");
    recommendation = "NO_PROMO_TO_RECOMMEND";
  } else if (promotions.length >= 3) {
    recommendation = "MULTIPLE_PROMOS_AVAILABLE";
  } else {
    recommendation = promotions[0]?.promotion?.name ?? null;
  }

  return {
    keyFindings,
    recommendation,
    riskFlags,
    promotionDetails,
  };
}
