/**
 * Phase 12 — Confidence Tracker
 * calculate(response, ragResults, intentCertainty) → number (0-1)
 * If confidence < 0.65 → trigger handoff, do NOT send uncertain response to customer
 */
export interface RAGResultForConfidence {
  score?: number;
}

export interface ConfidenceInput {
  response: string;
  ragResults?: RAGResultForConfidence[];
  intentCertainty?: number;
}

const HEDGING_WORDS = /อาจจะ|ไม่แน่ใจ|ประมาณ|คงจะ|อาจเป็น|น่าจะ|ไม่รู้ว่า|ไม่มั่นใจ/;

/**
 * Response quality score (0–1)
 * Base: 0.5
 * +0.20 if has specific numbers
 * +0.10 if length 30–200 chars
 * +0.20 if no hedging words
 */
function scoreResponseQuality(response: string): number {
  let score = 0.5;

  // +0.20 if has specific numbers (บาท, %, วันที่, etc.)
  if (/\d+(\s*(บาท|%|โมง|นาที|ชั่วโมง|วัน|เดือน|ครั้ง))/.test(response)) {
    score += 0.2;
  }

  const len = response.length;
  if (len >= 30 && len <= 200) score += 0.1;

  if (!HEDGING_WORDS.test(response)) score += 0.2;

  return Math.min(1, score);
}

/**
 * Max score from RAG results (0–1)
 */
function scoreRAGQuality(ragResults?: RAGResultForConfidence[]): number {
  if (!ragResults || ragResults.length === 0) return 0.5;
  const scores = ragResults.map((r) => r.score ?? 0).filter((s) => s >= 0 && s <= 1);
  if (scores.length === 0) return 0.5;
  return Math.max(...scores);
}

/**
 * Calculate overall AI confidence (0–1)
 * Weights: intent 30%, RAG 40%, response 30%
 */
export function calculate(input: ConfidenceInput): number {
  const intentWeight = 0.3;
  const ragWeight = 0.4;
  const responseWeight = 0.3;

  const intentScore = Math.min(1, Math.max(0, input.intentCertainty ?? 0.7));
  const ragScore = scoreRAGQuality(input.ragResults);
  const responseScore = scoreResponseQuality(input.response);

  const total =
    intentScore * intentWeight +
    ragScore * ragWeight +
    responseScore * responseWeight;

  return Math.round(total * 100) / 100;
}

export const CONFIDENCE_THRESHOLD = 0.65;

export function shouldTriggerHandoff(confidence: number): boolean {
  return confidence < CONFIDENCE_THRESHOLD;
}
