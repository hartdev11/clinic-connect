/**
 * Enterprise Knowledge Brain — Semantic Duplicate Detection
 * Phase 2 #14: ก่อน create — query VM vector search similarity > 0.92
 */
import type { StructuredKnowledgeContext } from "@/types/knowledge-brain";

const SIMILARITY_THRESHOLD = 0.92;
const TOP_K_CHECK = 5;

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
    const baseUrl =
      process.env.KNOWLEDGE_VECTOR_URL?.trim().replace(/\/+$/, "") ??
      process.env.PHASE_G_URL?.trim().replace(/\/+$/, "");
    if (!baseUrl) {
      throw new Error("Missing KNOWLEDGE_VECTOR_URL/PHASE_G_URL");
    }
    const serviceSecret = process.env.PHASE_SERVICE_SECRET?.trim() ?? "";
    const res = await fetch(`${baseUrl}/api/knowledge/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": serviceSecret,
      },
      body: JSON.stringify({
        tenant_id: orgId,
        clinic_id: orgId,
        query: text,
        top_k: TOP_K_CHECK,
      }),
    });
    if (!res.ok) {
      throw new Error(`VM search failed: ${res.status}`);
    }
    const payload = await res.json().catch(() => ({}));
    const matches = Array.isArray(payload?.results) ? payload.results : [];

    const candidates: Array<{ id: string; score: number }> = [];
    const addMatch = (m: Record<string, unknown>) => {
      const id = String(m.id ?? "");
      const score = typeof m.score === "number" ? m.score : 0;
      if (id && score > 0) {
        const normalizedId = id.replace(/^(clinic_|global_)/, "");
        if (excludeId && normalizedId === excludeId) return;
        candidates.push({ id: normalizedId, score });
      }
    };
    matches.forEach(addMatch);

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
