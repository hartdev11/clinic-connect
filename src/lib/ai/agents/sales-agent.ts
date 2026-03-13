/**
 * Sales Analytics Agent — Phase 6
 * Role: สร้างความสนใจ, upsell, close sales
 * Trigger intents: sales_inquiry, price_inquiry
 * Output: response with CTA buttons suggestion
 */
import { getActivePromotionsForAI } from "@/lib/clinic-data";
import type { AnalyticsAgentOutput } from "../types";
import type { AnalyticsContext } from "../types";

const AGENT_NAME = "sales-agent";
const TIMEOUT_MS = 200;

export async function runSalesAgent(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const start = Date.now();

  try {
    const timeoutPromise = new Promise<AnalyticsAgentOutput>((_, reject) =>
      setTimeout(() => reject(new Error("Sales agent timeout")), TIMEOUT_MS)
    );

    const result = await Promise.race([
      executeSalesAnalytics(ctx),
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
      riskFlags: ["SALES_DATA_UNAVAILABLE"],
    };
  }
}

async function executeSalesAnalytics(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const { org_id, branch_id, userMessage } = ctx;

  const keyFindings: string[] = [];
  const riskFlags: string[] = [];
  let recommendation: string | null = null;

  const isSalesIntent =
    userMessage &&
    /สนใจ|อยากทำ|อยากลอง|ราคา|เท่าไหร่|โปร|ลด|มีโปร|กี่บาท/i.test(userMessage);

  if (!isSalesIntent) {
    return {
      keyFindings: ["sales_intent:no"],
      recommendation: null,
      riskFlags: [],
    };
  }

  const promotions = await getActivePromotionsForAI(org_id, {
    branchId: branch_id ?? undefined,
    limit: 8,
  });

  for (const p of promotions.slice(0, 5)) {
    if (p.name) keyFindings.push(`promo:${p.name}`);
    if (p.aiSummary) keyFindings.push(`promo_summary:${p.aiSummary.slice(0, 80)}`);
    if (p.extractedPrice != null) keyFindings.push(`promo_price:${p.extractedPrice}`);
  }

  if (promotions.length > 0) {
    recommendation = "CTA_BOOK_CONSULTATION";
    keyFindings.push("cta_suggest:จองปรึกษา|ดูโปรเพิ่ม|นัดหมาย");
  } else {
    riskFlags.push("NO_ACTIVE_PROMOTIONS");
  }

  return {
    keyFindings: keyFindings.slice(0, 15),
    recommendation,
    riskFlags,
  };
}
