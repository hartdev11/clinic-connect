/**
 * Promotion semantic search — AI-native, zero manual categories.
 * Embed promotions (name + description + extracted metadata); vector similarity for "โปรจมูก", "ฟิลเลอร์", etc.
 */
import { embedKnowledgeText } from "@/lib/knowledge-brain/vector";
import { getActivePromotionsForAI } from "@/lib/clinic-data";
import type { Promotion } from "@/types/clinic";

const DEFAULT_TOP_K = 8;

/** Build text to embed from promotion — all AI-relevant content for semantic search */
export function buildPromotionEmbeddableText(p: Promotion): string {
  const parts: string[] = [p.name];
  if (p.description) parts.push(p.description);
  if (p.aiSummary) parts.push(p.aiSummary);
  if (p.aiTags?.length) parts.push(p.aiTags.join(" "));
  if (p.extractedProcedures?.length) parts.push(p.extractedProcedures.join(" "));
  if (p.extractedKeywords?.length) parts.push(p.extractedKeywords.join(" "));
  if (p.extractedBenefits?.length) parts.push(p.extractedBenefits.join(" "));
  return parts.filter(Boolean).join(" ").slice(0, 8191);
}

/** Generate embedding for a promotion and return vector (same model/dim as knowledge). */
export async function embedPromotionText(text: string): Promise<number[]> {
  return embedKnowledgeText(text);
}

/** Cosine similarity (vectors assumed from same model; no need to normalize for sort). */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export interface PromotionSearchHit {
  promotion: Promotion;
  score: number;
}

/**
 * Semantic search: embed user query, score active promotions by similarity, return top K.
 * Filters: status=active, visibleToAI, branchIds match. Supports ALL procedures (no hardcoded categories).
 */
export async function searchPromotionsBySemantic(
  orgId: string,
  queryText: string,
  opts: { branchId?: string | null; isNewCustomer?: boolean; topK?: number } = {}
): Promise<PromotionSearchHit[]> {
  const topK = opts.topK ?? DEFAULT_TOP_K;
  const promotions = await getActivePromotionsForAI(orgId, {
    branchId: opts.branchId ?? undefined,
    isNewCustomer: opts.isNewCustomer,
    limit: 50,
  });
  const withEmbedding = promotions.filter((p) => p.promotionEmbedding && p.promotionEmbedding.length > 0);
  if (withEmbedding.length === 0) return [];

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedPromotionText(queryText.trim() || "โปรโมชั่น");
  } catch {
    return [];
  }

  const scored: PromotionSearchHit[] = withEmbedding.map((p) => ({
    promotion: p,
    score: cosineSimilarity(queryEmbedding, p.promotionEmbedding!),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
