/**
 * Phase 3 #1 — Retrieval Confidence Engine
 * Zero hallucination tolerance: weighted confidence → full/restricted/abstain
 * Phase 14: Context re-ranker — keyword + recency + topic boost
 */
import type { KnowledgeSearchHit } from "./vector";

export type RetrievalMode = "full" | "restricted" | "abstain";

const FULL_THRESHOLD = 0.85;
const RESTRICTED_THRESHOLD = 0.7;

/** Stopwords to ignore when extracting keywords from query */
const STOPWORDS = new Set(["ที่", "ใน", "เป็น", "คือ", "มี", "ไหม"]);

/** Phase 14: Extract meaningful keywords from query (ignore stopwords) */
function extractQueryKeywords(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return [...new Set(tokens)];
}

/** Phase 14: Re-rank hits by base_score + keyword_boost + recency_boost + context_boost. Returns top 3. */
export function reRankKnowledgeHits(
  hits: KnowledgeSearchHit[],
  query: string,
  opts?: { recentConversationTopic?: string }
): KnowledgeSearchHit[] {
  if (hits.length === 0) return [];

  const keywords = extractQueryKeywords(query);
  const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const scored = hits.map((h) => {
    const baseScore = typeof h.score === "number" ? Math.max(0, Math.min(1, h.score)) : 0.5;

    let keywordBoost = 0;
    const content = String((h.metadata?.content ?? h.metadata?.key_points ?? "") || "");
    const topic = String(h.metadata?.topic ?? h.metadata?.service_name ?? "");
    const searchable = `${content} ${topic}`.toLowerCase();
    for (const kw of keywords) {
      if (searchable.includes(kw.toLowerCase())) keywordBoost += 0.05;
    }
    keywordBoost = Math.min(0.2, keywordBoost);

    let recencyBoost = 0;
    const embeddedAt = h.metadata?.embedded_at as number | undefined;
    const lastReviewed = h.metadata?.last_reviewed_at as number | undefined;
    const docTime = embeddedAt ?? lastReviewed;
    if (typeof docTime === "number" && now - docTime < MS_30_DAYS) {
      recencyBoost = 0.05;
    }

    let contextBoost = 0;
    if (opts?.recentConversationTopic && topic) {
      const topicLower = opts.recentConversationTopic.toLowerCase();
      if (topic.toLowerCase().includes(topicLower) || topicLower.includes(topic.toLowerCase())) {
        contextBoost = 0.1;
      }
    }

    const finalScore = Math.min(1, baseScore + keywordBoost + recencyBoost + contextBoost);
    return { hit: h, finalScore };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored.slice(0, 3).map((s) => s.hit);
}

/** Weights: avg_similarity 50%, field_completeness 25%, knowledge_quality_score 25% */
export function computeRetrievalConfidenceWeighted(
  hits: KnowledgeSearchHit[],
  opts: {
    fieldCompleteness?: number; // 0-1
    knowledgeQualityScore?: number; // 0-100 → normalized to 0-1
  }
): number {
  if (hits.length === 0) return 0;

  const scores = hits.map((h) => (typeof h.score === "number" ? h.score : 0)).filter((s) => s > 0);
  const avgSimilarity = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const fc = Math.min(1, Math.max(0, opts.fieldCompleteness ?? 0.8));
  const qs = typeof opts.knowledgeQualityScore === "number"
    ? Math.min(1, Math.max(0, opts.knowledgeQualityScore / 100))
    : 0.8;

  const w = { sim: 0.5, fc: 0.25, qs: 0.25 };
  return Math.min(1, Math.max(0, avgSimilarity * w.sim + fc * w.fc + qs * w.qs));
}

export function getRetrievalMode(confidence: number): RetrievalMode {
  if (confidence >= FULL_THRESHOLD) return "full";
  if (confidence >= RESTRICTED_THRESHOLD) return "restricted";
  return "abstain";
}

export function isFullResponseAllowed(mode: RetrievalMode): boolean {
  return mode === "full";
}

export function isAbstainRequired(mode: RetrievalMode): boolean {
  return mode === "abstain";
}

export function isRestrictedMode(mode: RetrievalMode): boolean {
  return mode === "restricted";
}

export { FULL_THRESHOLD, RESTRICTED_THRESHOLD };
