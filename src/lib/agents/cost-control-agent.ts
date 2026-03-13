/**
 * Phase 22 — Cost Control Agent
 * Per-conversation token budget enforcement by plan
 */
import type { OrgPlan } from "@/types/organization";

export const TOKEN_BUDGET_BY_PLAN: Record<OrgPlan, number> = {
  starter: 500,
  professional: 800,
  multi_branch: 1500,
  enterprise: 2000,
};

export interface CostControlCheck {
  allowed: boolean;
  remainingTokens: number;
  shouldUseCheaperModel: boolean;
  atLimit: boolean;
  templateResponse?: string;
}

export function checkTokenBudget(
  plan: OrgPlan,
  tokensUsedThisConversation: number
): CostControlCheck {
  const budget = TOKEN_BUDGET_BY_PLAN[plan] ?? 800;
  const remaining = Math.max(0, budget - tokensUsedThisConversation);
  const atLimit = remaining <= 0;
  const approaching = remaining < budget * 0.2;

  if (atLimit) {
    return {
      allowed: false,
      remainingTokens: 0,
      shouldUseCheaperModel: false,
      atLimit: true,
      templateResponse:
        "โควต้าสำหรับการคุยรอบนี้ครบแล้วค่ะ มีคำถามเพิ่มเติมแชทมาได้เลย หรือโทรมาคลินิกได้นะคะ 😊",
    };
  }

  return {
    allowed: true,
    remainingTokens: remaining,
    shouldUseCheaperModel: approaching,
    atLimit: false,
  };
}
