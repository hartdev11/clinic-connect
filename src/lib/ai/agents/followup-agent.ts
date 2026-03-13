/**
 * Follow-up Analytics Agent — Phase 6
 * Role: ติดตามลูกค้าที่สนใจ, เตือนก่อนนัด, ขอบคุณหลังใช้บริการ
 * Trigger: follow_up intent OR scheduled push
 */
import { listConversationFeedback } from "@/lib/clinic-data";
import type { AnalyticsAgentOutput } from "../types";
import type { AnalyticsContext } from "../types";

const AGENT_NAME = "followup-agent";
const TIMEOUT_MS = 180;

export async function runFollowupAgent(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const start = Date.now();

  try {
    const timeoutPromise = new Promise<AnalyticsAgentOutput>((_, reject) =>
      setTimeout(() => reject(new Error("Follow-up agent timeout")), TIMEOUT_MS)
    );

    const result = await Promise.race([
      executeFollowupAnalytics(ctx),
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
      riskFlags: ["FOLLOWUP_DATA_UNAVAILABLE"],
    };
  }
}

async function executeFollowupAnalytics(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const { org_id, branch_id, userMessage } = ctx;

  const keyFindings: string[] = [];
  const riskFlags: string[] = [];
  let recommendation: string | null = null;

  const isFollowUpIntent =
    userMessage &&
    /ติดตาม|รออยู่|คิดยัง|ตัดสินใจยัง|ยังไง|แล้วจะบอก|จะแจ้งให้ทราบ/i.test(userMessage);

  if (!isFollowUpIntent && !ctx.userId) {
    return {
      keyFindings: ["followup_intent:no"],
      recommendation: null,
      riskFlags: [],
    };
  }

  if (ctx.userId) {
    const { items } = await listConversationFeedback(org_id, {
      branchId: branch_id ?? undefined,
      limit: 10,
    });
    const userItems = items.filter((f) => f.user_id === ctx.userId);
    const recentInterest = userItems.some(
      (i) =>
        i.userMessage &&
        /สนใจ|อยาก|โปร|ราคา|จอง/i.test(i.userMessage) &&
        !/ไม่สนใจ|ไม่เอา|cancel/i.test(i.userMessage)
    );
    if (recentInterest) {
      keyFindings.push("followup_recent_interest:yes");
      recommendation = "FOLLOW_UP_GENTLE_REMINDER";
      keyFindings.push("followup_tone:อ่อนโยน ไม่เร่ง ขอบคุณที่สนใจ");
    }
  }

  if (isFollowUpIntent) {
    keyFindings.push("followup_intent:yes");
    recommendation = recommendation ?? "FOLLOW_UP_ACKNOWLEDGE";
  }

  return {
    keyFindings: keyFindings.slice(0, 10),
    recommendation,
    riskFlags,
  };
}
