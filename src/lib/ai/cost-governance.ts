/**
 * Cost Governance Layer — Enterprise
 * Budget cap per org, hard stop, model downgrade, alert threshold
 */
import { db } from "@/lib/firebase-admin";
import { getDailyLLMCost } from "@/lib/llm-metrics";
import { log } from "@/lib/logger";
import type { OrgAIBudget } from "@/types/ai-enterprise";

const COLLECTION = "org_ai_budgets";
const ALERT_THRESHOLD_DEFAULT = 80;
const DEFAULT_DAILY_BAHT = 500;

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

/** ดึง budget config ของ org */
export async function getOrgAIBudget(orgId: string): Promise<OrgAIBudget | null> {
  const doc = await db.collection(COLLECTION).doc(orgId).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    org_id: orgId,
    monthly_budget_baht: d.monthly_budget_baht ?? 0,
    daily_budget_baht: d.daily_budget_baht ?? DEFAULT_DAILY_BAHT,
    hard_stop_enabled: d.hard_stop_enabled ?? true,
    alert_threshold_percent: d.alert_threshold_percent ?? ALERT_THRESHOLD_DEFAULT,
    model_downgrade_enabled: d.model_downgrade_enabled ?? false,
    fallback_model: d.fallback_model,
    updated_at: toISO(d.updated_at),
  };
}

/** ตรวจว่า org เกิน budget หรือไม่ — Hard Stop */
export async function checkBudgetHardStop(orgId: string): Promise<{
  allowed: boolean;
  reason?: string;
  currentBaht?: number;
  limitBaht?: number;
  shouldUseFallbackModel?: boolean;
}> {
  const budget = await getOrgAIBudget(orgId);
  const dailyLimit = budget?.daily_budget_baht ?? Number(process.env.MAX_DAILY_LLM_COST_BAHT ?? DEFAULT_DAILY_BAHT);
  const hardStopEnabled = budget?.hard_stop_enabled ?? true;

  const currentBaht = await getDailyLLMCost(orgId);

  if (hardStopEnabled && dailyLimit > 0 && currentBaht >= dailyLimit) {
    log.warn("Cost governance: hard stop", { org_id: orgId, currentBaht, dailyLimit });
    return {
      allowed: false,
      reason: "BUDGET_EXCEEDED",
      currentBaht,
      limitBaht: dailyLimit,
    };
  }

  const threshold = (budget?.alert_threshold_percent ?? ALERT_THRESHOLD_DEFAULT) / 100;
  if (dailyLimit > 0 && currentBaht >= dailyLimit * threshold) {
    log.warn("Cost governance: alert threshold", {
      org_id: orgId,
      currentBaht,
      limitBaht: dailyLimit,
      percent: Math.round(threshold * 100),
    });
    return {
      allowed: true,
      currentBaht,
      limitBaht: dailyLimit,
      shouldUseFallbackModel: budget?.model_downgrade_enabled ?? false,
    };
  }

  return { allowed: true, currentBaht, limitBaht: dailyLimit };
}

/** ดึง model ที่ควรใช้ — downgrade เมื่อถึง threshold */
export async function getEffectiveModel(orgId: string): Promise<string> {
  const check = await checkBudgetHardStop(orgId);
  const budget = await getOrgAIBudget(orgId);
  if (
    check.shouldUseFallbackModel &&
    budget?.fallback_model &&
    (check.currentBaht ?? 0) >= ((check.limitBaht ?? 0) * (budget.alert_threshold_percent / 100))
  ) {
    return budget.fallback_model;
  }
  return "gpt-4o-mini";
}
