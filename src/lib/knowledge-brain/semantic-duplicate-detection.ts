/**
 * Enterprise Knowledge Brain — Semantic Duplicate Detection
 * Phase 2 #14: ก่อน create — embed draft, query Pinecone similarity > 0.92
 */
import { embedKnowledgeText } from "./vector";
import { getKnowledgeIndex } from "@/lib/pinecone";
import type { StructuredKnowledgeContext } from "@/types/knowledge-brain";

const NAMESPACE_PREFIX = "kb";
const SIMILARITY_THRESHOLD = 0.92;
const TOP_K_CHECK = 5;

function getOrgNamespace(orgId: string): string {
  return `${NAMESPACE_PREFIX}_${orgId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

const GLOBAL_NAMESPACE = `${NAMESPACE_PREFIX}_global`;

/** Build embeddable text จาก structured context */
function buildEmbeddableText(ctx: StructuredKnowledgeContext): string {
  const parts: string[] = [
    ctx.service_name,
    ctx.category,
    ...ctx.suitable_for,
    ...ctx.not_suitable_for,
    ...ctx.risks,
  ];
  if (ctx.clinic_brand) parts.push(ctx.clinic_brand);
  if (ctx.price_range) parts.push(ctx.price_range);
  if (ctx.differentiator) parts.push(ctx.differentiator);
  return parts.filter(Boolean).join(" ");
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicate_of: string | null;
  similarity_score: number | null;
  similar_ids: Array<{ id: string; score: number }>;
}

/**
 * ตรวจสอบ semantic duplicate — ก่อน create clinic knowledge
 */
export async function checkSemanticDuplicate(
  orgId: string,
  ctx: StructuredKnowledgeContext,
  excludeId?: string | null
): Promise<DuplicateCheckResult> {
  try {
    const text = buildEmbeddableText(ctx);
    const embedding = await embedKnowledgeText(text);
    const index = getKnowledgeIndex();
    const orgNs = index.namespace(getOrgNamespace(orgId));
    const globalNs = index.namespace(GLOBAL_NAMESPACE);

    const [orgRes, globalRes] = await Promise.all([
      orgNs.query({ vector: embedding, topK: TOP_K_CHECK, includeMetadata: true }),
      globalNs.query({ vector: embedding, topK: TOP_K_CHECK, includeMetadata: true }),
    ]);

    const candidates: Array<{ id: string; score: number }> = [];
    const addMatch = (m: { id?: string | null; score?: number | null }) => {
      const id = m.id?.toString?.() ?? "";
      const score = typeof m.score === "number" ? m.score : 0;
      if (id && score > 0) {
        const normalizedId = id.replace(/^(clinic_|global_)/, "");
        if (excludeId && normalizedId === excludeId) return;
        candidates.push({ id: normalizedId, score });
      }
    };
    (orgRes.matches ?? []).forEach(addMatch);
    (globalRes.matches ?? []).forEach(addMatch);

    const byId = new Map<string, number>();
    for (const c of candidates) {
      const existing = byId.get(c.id);
      if (!existing || c.score > existing) byId.set(c.id, c.score);
    }
    const sorted = [...byId.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_K_CHECK)
      .map(([id, score]) => ({ id, score }));

    const top = sorted[0];
    const isDuplicate = top != null && top.score >= SIMILARITY_THRESHOLD;

    return {
      isDuplicate,
      duplicate_of: isDuplicate ? top.id : null,
      similarity_score: top?.score ?? null,
      similar_ids: sorted,
    };
  } catch (err) {
    console.warn("[SemanticDuplicate] Check failed:", (err as Error)?.message?.slice(0, 80));
    return {
      isDuplicate: false,
      duplicate_of: null,
      similarity_score: null,
      similar_ids: [],
    };
  }
}
