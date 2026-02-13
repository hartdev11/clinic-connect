/**
 * Feedback Analytics Agent
 * Data/Logic only — NO LLM
 * ดึง Golden Dataset จาก Firestore → business logic → JSON structured output
 * Target: <200ms
 */
import { listConversationFeedback } from "@/lib/clinic-data";
import type { AnalyticsAgentOutput } from "../types";
import type { AnalyticsContext } from "../types";

const AGENT_NAME = "feedback-agent";
const TIMEOUT_MS = 180;

export async function runFeedbackAgent(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const start = Date.now();

  try {
    const timeoutPromise = new Promise<AnalyticsAgentOutput>((_, reject) =>
      setTimeout(() => reject(new Error("Feedback agent timeout")), TIMEOUT_MS)
    );

    const result = await Promise.race([
      executeFeedbackAnalytics(ctx),
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
      riskFlags: ["FEEDBACK_DATA_UNAVAILABLE"],
    };
  }
}

async function executeFeedbackAnalytics(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const { org_id, branch_id } = ctx;

  const { items } = await listConversationFeedback(org_id, {
    branchId: branch_id ?? undefined,
    limit: 30,
  });

  const keyFindings: string[] = [];
  const riskFlags: string[] = [];
  let recommendation: string | null = null;

  const labeled = items.filter((i) => i.adminLabel);
  const success = labeled.filter((i) => i.adminLabel === "success").length;
  const fail = labeled.filter((i) => i.adminLabel === "fail").length;

  keyFindings.push(`total_labeled:${labeled.length}`);
  keyFindings.push(`success_rate:${labeled.length > 0 ? (success / labeled.length).toFixed(2) : "0"}`);

  const intents = [...new Set(items.map((i) => i.intent).filter(Boolean))];
  for (const intent of intents.slice(0, 5)) {
    keyFindings.push(`intent:${intent}`);
  }

  if (labeled.length > 0 && fail / labeled.length > 0.3) {
    riskFlags.push("HIGH_FAIL_RATE");
  }

  if (labeled.length === 0) {
    recommendation = "NO_LABELED_DATA";
  } else if (success / labeled.length >= 0.8) {
    recommendation = "QUALITY_GOOD";
  }

  return {
    keyFindings,
    recommendation,
    riskFlags,
  };
}
