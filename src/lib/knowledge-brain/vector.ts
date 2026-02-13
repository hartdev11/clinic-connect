/**
 * Enterprise Knowledge Brain — Vector RAG
 * text-embedding-3-large, Pinecone namespace = org_id
 * Embed เฉพาะ status=approved
 * Circuit breaker: when Pinecone open → skip search, return []
 */
import { getOpenAI } from "@/lib/agents/clients";
import { getKnowledgeIndex, getPineconeClient } from "@/lib/pinecone";
import {
  isVectorSearchDisabled,
  recordProviderFailure,
  recordProviderSuccess,
} from "@/lib/provider-circuit-breaker";
import type { GlobalKnowledge, ClinicKnowledge, StructuredKnowledgeContext } from "@/types/knowledge-brain";

const EMBEDDING_MODEL = process.env.KNOWLEDGE_BRAIN_EMBEDDING_MODEL ?? "text-embedding-3-large";
/** Use 1536 to match existing Pinecone index; large model with dimensions=1536 gives better quality */
const EMBEDDING_DIMENSION = 1536;
const NAMESPACE_PREFIX = "kb"; // knowledge brain

function getOrgNamespace(orgId: string): string {
  return `${NAMESPACE_PREFIX}_${orgId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

const GLOBAL_NAMESPACE = `${NAMESPACE_PREFIX}_global`;

/** Build text สำหรับ embed — structured สำหรับ retrieval */
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

/** Create embedding */
export async function embedKnowledgeText(text: string): Promise<number[]> {
  const openai = getOpenAI();
  if (!openai) throw new Error("OPENAI_API_KEY required");
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8191),
    dimensions: EMBEDDING_DIMENSION,
  });
  const vec = res.data[0]?.embedding;
  if (!vec) throw new Error("No embedding returned");
  return vec;
}

/**
 * Phase 3 #10: Self-healing re-embed
 * Upsert overwrites by ID = atomic replace. Old vector effectively deprecated.
 * Zero downtime — no delete-then-insert window.
 */
export async function upsertClinicKnowledgeToVector(
  orgId: string,
  clinicDoc: ClinicKnowledge,
  _globalDoc: GlobalKnowledge,
  ctx: StructuredKnowledgeContext
): Promise<void> {
  const text = buildEmbeddableText(ctx);
  const embedding = await embedKnowledgeText(text);
  const index = getKnowledgeIndex();
  const ns = index.namespace(getOrgNamespace(orgId));
  const vectorId = `clinic_${clinicDoc.id}`;

  const lastReviewed =
    typeof clinicDoc.last_reviewed_at === "string"
      ? new Date(clinicDoc.last_reviewed_at).getTime()
      : typeof clinicDoc.updated_at === "string"
        ? new Date(clinicDoc.updated_at).getTime()
        : Date.now();
  const expiryDays = typeof clinicDoc.expiry_policy_days === "number" ? clinicDoc.expiry_policy_days : null;

  await ns.upsert({
    records: [
      {
        id: vectorId,
        values: embedding,
        metadata: {
          type: "clinic",
          org_id: orgId,
          service_name: ctx.service_name,
          category: ctx.category,
          content: text.slice(0, 2000),
          version: clinicDoc.version,
          deprecated: false,
          embedded_at: Date.now(),
          last_reviewed_at: lastReviewed,
          ...(expiryDays != null ? { expiry_policy_days: expiryDays } : {}),
          ...(Array.isArray(ctx.risks) && ctx.risks.length > 0
            ? { risks: ctx.risks.slice(0, 10).join(";") }
            : {}),
          ...(Array.isArray(ctx.contraindications) && ctx.contraindications?.length
            ? { contraindications: ctx.contraindications.slice(0, 5).join(";") }
            : {}),
          ...(ctx.price_range ? { price_range: String(ctx.price_range).slice(0, 100) } : {}),
          ...(typeof clinicDoc.knowledge_quality_score === "number"
            ? { quality_score: clinicDoc.knowledge_quality_score }
            : {}),
        },
      },
    ],
  });
}

/** Upsert global knowledge ลง Pinecone global namespace */
export async function upsertGlobalKnowledgeToVector(
  globalDoc: GlobalKnowledge,
  ctx: StructuredKnowledgeContext
): Promise<void> {
  const text = buildEmbeddableText(ctx);
  const embedding = await embedKnowledgeText(text);
  const index = getKnowledgeIndex();
  const ns = index.namespace(GLOBAL_NAMESPACE);

  await ns.upsert({
    records: [
      {
        id: `global_${globalDoc.id}`,
        values: embedding,
        metadata: {
          type: "global",
          service_name: ctx.service_name,
          category: ctx.category,
          content: text.slice(0, 2000),
          version: globalDoc.version,
        },
      },
    ],
  });
}

/** Delete clinic doc จาก vector (เมื่อ un-approve) */
export async function deleteClinicKnowledgeFromVector(orgId: string, clinicId: string): Promise<void> {
  try {
    const index = getKnowledgeIndex();
    const ns = index.namespace(getOrgNamespace(orgId));
    await ns.deleteOne({ id: `clinic_${clinicId}` });
  } catch {
    // ignore if not found
  }
}

/** Phase 2 #16: Search result with similarity_score for confidence layer */
export interface KnowledgeSearchHit {
  id: string;
  score?: number;
  metadata?: Record<string, unknown>;
  knowledge_source?: "global" | "clinic" | "merged";
  knowledge_version?: number;
}

/** Search — clinic namespace ก่อน, fallback global. Circuit breaker: skip when Pinecone open */
export async function searchKnowledgeBrain(
  orgId: string,
  query: string,
  topK = 5
): Promise<KnowledgeSearchHit[]> {
  if (isVectorSearchDisabled()) {
    return [];
  }

  const embedding = await embedKnowledgeText(query);
  const index = getKnowledgeIndex();
  const orgNs = index.namespace(getOrgNamespace(orgId));
  const globalNs = index.namespace(GLOBAL_NAMESPACE);

  try {
    const [orgRes, globalRes] = await Promise.all([
      orgNs.query({ vector: embedding, topK, includeMetadata: true }),
      globalNs.query({ vector: embedding, topK, includeMetadata: true }),
    ]);

    const now = Date.now();
    const MS_PER_DAY = 86400000;
    const orgMatchesRaw = (orgRes.matches ?? []).map((m) => ({
      id: m.id ?? "",
      score: m.score,
      metadata: m.metadata as Record<string, unknown> | undefined,
      knowledge_source: "clinic" as const,
      knowledge_version: (m.metadata?.version as number) ?? undefined,
    }));

    const orgMatches = orgMatchesRaw.filter((m) => {
      const meta = m.metadata;
      const expiryDays = typeof meta?.expiry_policy_days === "number" ? meta.expiry_policy_days : null;
      if (expiryDays == null) return true; // no expiry policy = keep
      const lastReviewed =
        typeof meta?.last_reviewed_at === "number"
          ? meta.last_reviewed_at
          : meta?.embedded_at != null
            ? Number(meta.embedded_at)
            : now;
      return now - lastReviewed < expiryDays * MS_PER_DAY; // within TTL = keep
    });

    if (orgMatches.length >= topK) return orgMatches.slice(0, topK);

    const globalMatches = (globalRes.matches ?? []).map((m) => ({
      id: m.id ?? "",
      score: m.score,
      metadata: m.metadata as Record<string, unknown> | undefined,
      knowledge_source: "global" as const,
      knowledge_version: (m.metadata?.version as number) ?? undefined,
    }));

    const combined: KnowledgeSearchHit[] = [...orgMatches];
    for (const g of globalMatches) {
      if (combined.length >= topK) break;
      if (!combined.some((o) => o.id === g.id)) combined.push(g);
    }
    recordProviderSuccess("pinecone");
    return combined.slice(0, topK);
  } catch (err) {
    recordProviderFailure("pinecone");
    console.warn("[KnowledgeBrain] Vector search failed:", (err as Error)?.message?.slice(0, 80));
    return [];
  }
}

/** Phase 2 #16: Calculate retrieval confidence 0–1 from top similarity score */
export function calculateRetrievalConfidence(hits: KnowledgeSearchHit[]): number {
  if (hits.length === 0) return 0;
  const topScore = hits[0]?.score;
  if (topScore == null || typeof topScore !== "number") return 0;
  return Math.min(1, Math.max(0, topScore));
}

const LOW_CONFIDENCE_THRESHOLD = 0.75;
export { LOW_CONFIDENCE_THRESHOLD };
