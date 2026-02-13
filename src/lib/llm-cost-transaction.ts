/**
 * Transaction-Safe LLM Cost Guard
 * reserveLLMBudget → runTransaction (read, check, increment)
 * reconcileLLMUsage → adjust actual vs reserved
 */
import { db } from "@/lib/firebase-admin";
import { getTodayKeyBangkok } from "@/lib/timezone";
import { toSatang } from "@/lib/money";
import type { LLMUsage } from "@/lib/llm-metrics";
import { estimateCostBaht } from "@/lib/llm-metrics";

const COLLECTION = "llm_usage_daily";

export class DailyLimitExceededError extends Error {
  constructor(public readonly orgId: string) {
    super("DAILY_LIMIT_EXCEEDED");
    this.name = "DailyLimitExceededError";
  }
}

function getLimitSatang(): number {
  const limitBaht = Number(process.env.MAX_DAILY_LLM_COST_BAHT ?? 0);
  if (limitBaht <= 0) return 0;
  return toSatang(limitBaht);
}

/**
 * Reserve budget before calling LLM. Throws DailyLimitExceededError if over limit.
 * ใช้ satang เพื่อ precision
 */
export async function reserveLLMBudget(
  orgId: string,
  estimatedCostSatang: number,
  correlationId?: string
): Promise<void> {
  const limit = getLimitSatang();
  if (limit <= 0) return;
  if (estimatedCostSatang <= 0) return;

  const key = `${orgId}_${getTodayKeyBangkok()}`;
  const docRef = db.collection(COLLECTION).doc(key);

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(docRef);
    const data = doc.data() ?? {};
    const currentCostBaht = Number(data.cost_baht ?? 0);
    const reservedSatang = Number(data.reserved_cost_satang ?? 0);
    const currentSatang = toSatang(currentCostBaht);
    const totalSatang = currentSatang + reservedSatang + estimatedCostSatang;
    if (totalSatang >= limit) {
      throw new DailyLimitExceededError(orgId);
    }
    tx.set(docRef, {
      org_id: orgId,
      date: getTodayKeyBangkok(),
      reserved_cost_satang: (reservedSatang || 0) + estimatedCostSatang,
      updatedAt: new Date(),
      _last_reserve_correlation: correlationId,
    }, { merge: true });
  });
}

/**
 * Reconcile actual usage after LLM call.
 * Add actual cost to cost_baht, release reserved amount from reserved_cost_satang
 */
export async function reconcileLLMUsage(
  orgId: string,
  reservedSatang: number,
  actualUsage: LLMUsage,
  _correlationId?: string
): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const key = `${orgId}_${getTodayKeyBangkok()}`;
  const docRef = db.collection(COLLECTION).doc(key);
  const costBaht = estimateCostBaht(actualUsage);

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(docRef);
    const data = doc.data() ?? {};
    const reserved = Number(data.reserved_cost_satang ?? 0);
    const newReserved = Math.max(0, reserved - reservedSatang);

    tx.set(
      docRef,
      {
        org_id: orgId,
        date: getTodayKeyBangkok(),
        reserved_cost_satang: newReserved,
        cost_baht: FieldValue.increment(costBaht),
        prompt_tokens: FieldValue.increment(actualUsage.prompt_tokens),
        completion_tokens: FieldValue.increment(actualUsage.completion_tokens),
        total_tokens: FieldValue.increment(actualUsage.total_tokens),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

/** Max possible cost per chat (satang) — conservative estimate */
export const MAX_ESTIMATED_COST_SATANG = 500; // ~5 baht per request worst case
