/**
 * Promotion Analytics Agent
 * Data/Logic only — NO LLM
 * ดึงโปรโมชันจาก Firestore → business logic → JSON structured output
 * Target: <200ms
 */
import { getPromotions } from "@/lib/clinic-data";
import type { AnalyticsAgentOutput } from "../types";
import type { AnalyticsContext } from "../types";

const AGENT_NAME = "promotion-agent";
const TIMEOUT_MS = 180;

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
  const { org_id, branch_id } = ctx;

  const promotions = await getPromotions(org_id, {
    branchId: branch_id ?? undefined,
    limit: 15,
  });

  const active = promotions.filter((p) => p.status === "active");
  const keyFindings: string[] = [];
  const riskFlags: string[] = [];
  let recommendation: string | null = null;

  for (const p of active.slice(0, 8)) {
    keyFindings.push(`promo:${p.name}|target:${p.targetGroup || "all"}`);
  }

  if (active.length === 0) {
    riskFlags.push("NO_ACTIVE_PROMOTIONS");
    recommendation = "NO_PROMO_TO_RECOMMEND";
  } else if (active.length >= 3) {
    recommendation = "MULTIPLE_PROMOS_AVAILABLE";
  } else {
    recommendation = active[0]?.name ?? null;
  }

  return {
    keyFindings,
    recommendation,
    riskFlags,
  };
}
