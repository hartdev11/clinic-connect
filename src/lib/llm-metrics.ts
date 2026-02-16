/**
 * LLM Usage Monitoring — บันทึก tokens + คำนวณ cost ต่อ org ต่อวัน
 * GPT-4o-mini: ~$0.15/1M input, ~$0.60/1M output (ประมาณ 5.5/22 บาท ต่อ 1M tokens)
 * Timezone: Asia/Bangkok
 * Enterprise: workloadType customer_chat | executive_brief | knowledge_assist → also writes to organizations/{orgId}/ai_usage_daily
 */
import { db } from "@/lib/firebase-admin";
import { getTodayKeyBangkok } from "@/lib/timezone";
import type { AIWorkloadType } from "@/lib/ai-usage-daily";

const COLLECTION = "llm_usage_daily";

// GPT-4o-mini pricing per 1M tokens (THB approx)
const INPUT_COST_PER_1M = 5.5;
const OUTPUT_COST_PER_1M = 22;

export interface LLMUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export function estimateCostBaht(usage: LLMUsage): number {
  const inputCost = (usage.prompt_tokens / 1_000_000) * INPUT_COST_PER_1M;
  const outputCost = (usage.completion_tokens / 1_000_000) * OUTPUT_COST_PER_1M;
  return Math.round((inputCost + outputCost) * 100) / 100;
}

function getTodayKey(): string {
  return getTodayKeyBangkok();
}

/** Normalize workload for legacy doc key */
function workloadSuffix(w: AIWorkloadType | undefined): string {
  if (w === "executive_brief") return "_executive_brief";
  if (w === "knowledge_assist") return "_knowledge_assist";
  return "";
}

/**
 * บันทึก LLM usage สำหรับ org
 * workloadType: customer_chat | executive_brief | knowledge_assist — also merges into organizations/{orgId}/ai_usage_daily/{date}
 */
export async function recordLLMUsage(
  orgId: string,
  usage: LLMUsage,
  options?: { workloadType?: AIWorkloadType }
): Promise<number> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const suffix = workloadSuffix(options?.workloadType);
  const key = `${orgId}_${getTodayKey()}${suffix}`;
  const cost = estimateCostBaht(usage);
  const docRef = db.collection(COLLECTION).doc(key);
  await docRef.set(
    {
      org_id: orgId,
      date: getTodayKey(),
      workload_type: options?.workloadType ?? "customer_chat",
      prompt_tokens: FieldValue.increment(usage.prompt_tokens),
      completion_tokens: FieldValue.increment(usage.completion_tokens),
      total_tokens: FieldValue.increment(usage.total_tokens),
      cost_baht: FieldValue.increment(cost),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  const workload: AIWorkloadType = options?.workloadType ?? "customer_chat";
  const { mergeAIUsageDaily } = await import("@/lib/ai-usage-daily");
  mergeAIUsageDaily(orgId, usage, workload).catch((e) =>
    console.error("[recordLLMUsage] mergeAIUsageDaily:", e)
  );
  return cost;
}

/**
 * คืนค่า cost รวมของ org วันนี้ (บาท)
 */
export async function getDailyLLMCost(orgId: string): Promise<number> {
  const key = `${orgId}_${getTodayKey()}`;
  const doc = await db.collection(COLLECTION).doc(key).get();
  if (!doc.exists) return 0;
  return Number(doc.data()?.cost_baht ?? 0);
}

/**
 * ตรวจว่า org เกิน daily limit หรือไม่
 */
export async function isOverDailyLLMLimit(orgId: string): Promise<boolean> {
  const limit = Number(process.env.MAX_DAILY_LLM_COST_BAHT ?? 0);
  if (limit <= 0) return false;
  const cost = await getDailyLLMCost(orgId);
  return cost >= limit;
}
