/**
 * Phase 12 — AI Pipeline Metrics for Cost Dashboard
 * organizations/{orgId}/metrics/{YYYY-MM-DD}
 * Tracks: cache_hits, cache_requests, template_responses, tokens_saved_by_cache, cost_saved_thb, confidence
 */
import { db } from "@/lib/firebase-admin";
import { getTodayKeyBangkok } from "@/lib/timezone";

function metricsRef(orgId: string, date: string) {
  return db.collection("organizations").doc(orgId).collection("metrics").doc(date);
}

export interface PipelineMetricsPayload {
  cacheHit?: boolean;
  templateResponse?: boolean;
  tokensSavedByCache?: number;
  costSavedThb?: number;
  aiConfidence?: number;
  /** Phase 22: Increment aiCost (THB) for real-time metrics */
  aiCostThb?: number;
  tokensUsed?: number;
}

/**
 * Record pipeline metrics after each chat completion.
 */
export async function recordPipelineMetrics(
  orgId: string,
  payload: PipelineMetricsPayload
): Promise<void> {
  try {
    const { FieldValue } = await import("firebase-admin/firestore");
    const today = getTodayKeyBangkok();
    const ref = metricsRef(orgId, today);

    const updates: Record<string, unknown> = {
      date: today,
      lastUpdated: FieldValue.serverTimestamp(),
    };

    // Cache: always increment requests when we're in cache-eligible path; hit/miss recorded separately
    if (payload.cacheHit !== undefined) {
      updates.cache_requests = FieldValue.increment(1);
      if (payload.cacheHit) {
        updates.cache_hits = FieldValue.increment(1);
      }
    }

    if (payload.templateResponse === true) {
      updates.template_responses = FieldValue.increment(1);
    }

    if (typeof payload.tokensSavedByCache === "number" && payload.tokensSavedByCache > 0) {
      updates.tokens_saved_by_cache = FieldValue.increment(payload.tokensSavedByCache);
    }

    if (typeof payload.costSavedThb === "number" && payload.costSavedThb > 0) {
      updates.cost_saved_thb = FieldValue.increment(payload.costSavedThb);
    }

    if (typeof payload.aiConfidence === "number") {
      updates.confidence_sum = FieldValue.increment(payload.aiConfidence);
      updates.confidence_count = FieldValue.increment(1);
    }

    if (typeof payload.aiCostThb === "number" && payload.aiCostThb > 0) {
      updates.aiCost = FieldValue.increment(payload.aiCostThb);
    }
    if (typeof payload.tokensUsed === "number" && payload.tokensUsed > 0) {
      updates.totalTokens = FieldValue.increment(payload.tokensUsed);
    }

    await ref.set(updates, { merge: true });
  } catch (err) {
    console.warn("[recordPipelineMetrics] error:", (err as Error)?.message?.slice(0, 80));
  }
}

export interface PipelineMetricsDoc {
  cache_hits?: number;
  cache_requests?: number;
  template_responses?: number;
  tokens_saved_by_cache?: number;
  cost_saved_thb?: number;
  confidence_sum?: number;
  confidence_count?: number;
  date?: string;
  lastUpdated?: string;
}

/**
 * Get pipeline metrics for an org for a date.
 */
export async function getPipelineMetrics(
  orgId: string,
  date: string
): Promise<PipelineMetricsDoc | null> {
  const doc = await metricsRef(orgId, date).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    cache_hits: Number(d.cache_hits ?? 0),
    cache_requests: Number(d.cache_requests ?? 0),
    template_responses: Number(d.template_responses ?? 0),
    tokens_saved_by_cache: Number(d.tokens_saved_by_cache ?? 0),
    cost_saved_thb: Number(d.cost_saved_thb ?? 0),
    confidence_sum: Number(d.confidence_sum ?? 0),
    confidence_count: Number(d.confidence_count ?? 0),
    date: String(d.date ?? date),
    lastUpdated: d.lastUpdated?.toDate?.()?.toISOString?.() ?? "",
  };
}

/**
 * Get this month's pipeline metrics for an org (for dashboard aggregation).
 */
export async function getPipelineMetricsThisMonth(orgId: string): Promise<{
  cacheHitRate: number;
  tokensSavedByCache: number;
  costSavedThb: number;
  templateResponses: number;
  avgConfidence: number;
}> {
  const today = getTodayKeyBangkok();
  const [y, m] = today.split("-");
  const daysInMonth = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${m}-${String(d).padStart(2, "0")}`;
    if (ds <= today) dates.push(ds);
  }

  let totalCacheHits = 0;
  let totalCacheRequests = 0;
  let totalTokensSaved = 0;
  let totalCostSaved = 0;
  let totalTemplates = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const date of dates) {
    const m = await getPipelineMetrics(orgId, date);
    if (m) {
      totalCacheHits += m.cache_hits ?? 0;
      totalCacheRequests += m.cache_requests ?? 0;
      totalTokensSaved += m.tokens_saved_by_cache ?? 0;
      totalCostSaved += m.cost_saved_thb ?? 0;
      totalTemplates += m.template_responses ?? 0;
      confidenceSum += m.confidence_sum ?? 0;
      confidenceCount += m.confidence_count ?? 0;
    }
  }

  const cacheHitRate = totalCacheRequests > 0 ? totalCacheHits / totalCacheRequests : 0;
  const avgConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;

  return {
    cacheHitRate,
    tokensSavedByCache: totalTokensSaved,
    costSavedThb: totalCostSaved,
    templateResponses: totalTemplates,
    avgConfidence,
  };
}

/**
 * Get pipeline metrics for all orgs (for admin dashboard).
 */
export async function getAggregatePipelineMetricsForOrgs(
  orgIds: string[]
): Promise<
  Record<
    string,
    {
      cacheHitRate: number;
      tokensSavedByCache: number;
      costSavedThb: number;
      templateResponses: number;
      avgConfidence: number;
    }
  >
> {
  const result: Record<
    string,
    {
      cacheHitRate: number;
      tokensSavedByCache: number;
      costSavedThb: number;
      templateResponses: number;
      avgConfidence: number;
    }
  > = {};

  for (const orgId of orgIds) {
    const m = await getPipelineMetricsThisMonth(orgId);
    result[orgId] = m;
  }

  return result;
}
