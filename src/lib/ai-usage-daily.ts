/**
 * Enterprise — AI usage per org per day
 * organizations/{orgId}/ai_usage_daily/{YYYY-MM-DD}
 * For admin cost monitor and per-workload tracking.
 */
import { db } from "@/lib/firebase-admin";
import { getTodayKeyBangkok, getDateKeyBangkokDaysAgo } from "@/lib/timezone";
import type { LLMUsage } from "@/lib/llm-metrics";
import { estimateCostBaht } from "@/lib/llm-metrics";

export type AIWorkloadType = "customer_chat" | "executive_brief" | "knowledge_assist";

function dailyRef(orgId: string, date: string) {
  return db.collection("organizations").doc(orgId).collection("ai_usage_daily").doc(date);
}

/**
 * Merge usage into org's daily doc. Called from recordLLMUsage.
 */
export async function mergeAIUsageDaily(
  orgId: string,
  usage: LLMUsage,
  workloadType: AIWorkloadType
): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const date = getTodayKeyBangkok();
  const cost = estimateCostBaht(usage);
  const ref = dailyRef(orgId, date);

  const payload: Record<string, unknown> = {
    orgId,
    date,
    totalTokens: FieldValue.increment(usage.total_tokens),
    totalCost: FieldValue.increment(cost),
    lastUpdated: FieldValue.serverTimestamp(),
    [`byWorkloadType.${workloadType}.tokens`]: FieldValue.increment(usage.total_tokens),
    [`byWorkloadType.${workloadType}.cost`]: FieldValue.increment(cost),
  };
  if (workloadType === "knowledge_assist") {
    payload["byWorkloadType.knowledge_assist.calls"] = FieldValue.increment(1);
  }
  await ref.set(payload, { merge: true });
}

export interface AIUsageDailyDoc {
  orgId: string;
  date: string;
  totalTokens: number;
  totalCost: number;
  byWorkloadType?: Record<string, { tokens?: number; cost?: number; calls?: number }>;
  lastUpdated: string;
}

/**
 * Get daily usage for an org (for admin or org view).
 */
export async function getAIUsageDaily(
  orgId: string,
  date: string
): Promise<AIUsageDailyDoc | null> {
  const doc = await dailyRef(orgId, date).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    orgId: String(d.orgId ?? orgId),
    date: String(d.date ?? date),
    totalTokens: Number(d.totalTokens ?? 0),
    totalCost: Number(d.totalCost ?? 0),
    byWorkloadType: (d.byWorkloadType as Record<string, { tokens?: number; cost?: number; calls?: number }>) ?? undefined,
    lastUpdated: d.lastUpdated?.toDate?.()?.toISOString?.() ?? "",
  };
}

const KNOWLEDGE_ASSIST_LIMIT_PER_DAY = 20;
const KNOWLEDGE_ASSIST_SOFT_WARNING_AT = 10;

/** คืนจำนวนครั้งที่เรียก Knowledge Assist ของ org วันนี้ */
export async function getKnowledgeAssistCallCount(orgId: string): Promise<number> {
  const date = getTodayKeyBangkok();
  const doc = await getAIUsageDaily(orgId, date);
  const k = doc?.byWorkloadType?.knowledge_assist;
  return typeof k?.calls === "number" ? k.calls : 0;
}

/** ตรวจว่า org เกิน limit (20/วัน) หรือเข้าโซน soft warning (10+) */
export function getKnowledgeAssistRateLimit(orgId: string): Promise<{ count: number; limit: number; overLimit: boolean; softWarning: boolean }> {
  return getKnowledgeAssistCallCount(orgId).then((count) => ({
    count,
    limit: KNOWLEDGE_ASSIST_LIMIT_PER_DAY,
    overLimit: count >= KNOWLEDGE_ASSIST_LIMIT_PER_DAY,
    softWarning: count >= KNOWLEDGE_ASSIST_SOFT_WARNING_AT && count < KNOWLEDGE_ASSIST_LIMIT_PER_DAY,
  }));
}

/**
 * List org ids (for admin cost monitor).
 */
export async function getOrgIdsWithUsageInRange(
  _startDate: string,
  _endDate: string
): Promise<string[]> {
  const orgsSnap = await db.collection("organizations").limit(500).get();
  return orgsSnap.docs.map((d) => d.id);
}


export interface OrgUsageRow {
  orgId: string;
  orgName?: string;
  totalCost7d: number;
  dailyCosts: { date: string; totalCost: number; byWorkloadType?: Record<string, { tokens?: number; cost?: number }> }[];
  lastUpdated?: string;
}

/**
 * Get last 7 days usage for one org.
 */
export async function getLast7DaysUsage(orgId: string): Promise<OrgUsageRow["dailyCosts"]> {
  const dates = Array.from({ length: 7 }, (_, i) => getDateKeyBangkokDaysAgo(i));
  const results = await Promise.all(dates.map((date) => getAIUsageDaily(orgId, date)));
  return results.map((r, i) => ({
    date: dates[i],
    totalCost: r?.totalCost ?? 0,
    byWorkloadType: r?.byWorkloadType,
  }));
}

/**
 * List orgs with 7-day usage for admin cost monitor. Sorted by totalCost7d desc.
 */
export async function listOrgsWithUsageLast7Days(): Promise<OrgUsageRow[]> {
  const today = getTodayKeyBangkok();
  const startDate = dateKeyDaysAgo(6);
  const orgIds = await getOrgIdsWithUsageInRange(startDate, today);
  const rows: OrgUsageRow[] = await Promise.all(
    orgIds.map(async (orgId) => {
      const dailyCosts = await getLast7DaysUsage(orgId);
      const totalCost7d = dailyCosts.reduce((sum, d) => sum + d.totalCost, 0);
      let orgName: string | undefined;
      try {
        const orgDoc = await db.collection("organizations").doc(orgId).get();
        orgName = (orgDoc.data()?.name as string) ?? orgDoc.data()?.displayName as string;
      } catch {
        // ignore
      }
      return { orgId, orgName, totalCost7d, dailyCosts };
    })
  );
  rows.sort((a, b) => b.totalCost7d - a.totalCost7d);
  return rows;
}
