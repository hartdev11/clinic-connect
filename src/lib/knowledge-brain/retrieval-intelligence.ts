/**
 * Phase 3 #1 — Retrieval Confidence Engine
 * Zero hallucination tolerance: weighted confidence → full/restricted/abstain
 */
import type { KnowledgeSearchHit } from "./vector";

export type RetrievalMode = "full" | "restricted" | "abstain";

const FULL_THRESHOLD = 0.85;
const RESTRICTED_THRESHOLD = 0.7;

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
