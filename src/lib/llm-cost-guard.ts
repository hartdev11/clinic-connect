/**
 * LLM Cost Explosion Defense
 * - Hard daily limit (มีแล้วใน llm-metrics)
 * - Soft warning 80%
 * - Alert log 100%
 * - Emergency global kill switch (GLOBAL_AI_DISABLED)
 */
import { getDailyLLMCost, type LLMUsage } from "@/lib/llm-metrics";
import { log } from "@/lib/logger";

const SOFT_WARNING_THRESHOLD = 0.8; // 80%
const ALERT_THRESHOLD = 1.0; // 100%

function getDailyLimitBaht(): number {
  return Number(process.env.MAX_DAILY_LLM_COST_BAHT ?? 0);
}

export function isGlobalAIDisabled(): boolean {
  const v = process.env.GLOBAL_AI_DISABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function checkCostGuards(
  orgId: string,
  estimatedCost: number
): Promise<
  | { allowed: true; warning?: "soft" }
  | { allowed: false; reason: "hard_limit" | "global_disabled" }
> {
  if (isGlobalAIDisabled()) {
    return { allowed: false, reason: "global_disabled" };
  }
  const limit = getDailyLimitBaht();
  if (limit <= 0) return { allowed: true };
  const current = await getDailyLLMCost(orgId);
  const after = current + estimatedCost;
  if (after >= limit) {
    log.warn("LLM cost hard limit reached", {
      org_id: orgId,
      current,
      limit,
      estimated_cost: estimatedCost,
    });
    return { allowed: false, reason: "hard_limit" };
  }
  const ratio = after / limit;
  if (ratio >= ALERT_THRESHOLD) {
    log.warn("LLM cost 100% alert", { org_id: orgId, current, limit });
  } else if (ratio >= SOFT_WARNING_THRESHOLD) {
    log.warn("LLM cost soft warning 80%", { org_id: orgId, current, limit, ratio });
    return { allowed: true, warning: "soft" };
  }
  return { allowed: true };
}
