/**
 * Enterprise Knowledge Brain — Vector RAG
 * text-embedding-3-large, Pinecone namespace = org_id
 * Embed เฉพาะ status=approved
 * Circuit breaker: when Pinecone open → skip search, return []
 */
import { getOpenAI } from "@/lib/agents/clients";
import {
  isVectorSearchDisabled,
  recordProviderFailure,
  recordProviderSuccess,
} from "@/lib/provider-circuit-breaker";
import type { GlobalKnowledge, ClinicKnowledge, StructuredKnowledgeContext } from "@/types/knowledge-brain";

const EMBEDDING_MODEL = process.env.KNOWLEDGE_BRAIN_EMBEDDING_MODEL ?? "text-embedding-3-large";
/** Use 1536 to match existing Pinecone index; large model with dimensions=1536 gives better quality */
const EMBEDDING_DIMENSION = 1536;
const KNOWLEDGE_UPLOAD_PATH = "/api/knowledge/upload";

function resolveKnowledgeVectorBaseUrl(): string | null {
  return (
    process.env.KNOWLEDGE_VECTOR_URL?.trim().replace(/\/+$/, "") ??
    process.env.PHASE_G_URL?.trim().replace(/\/+$/, "") ??
    null
  );
}

function toKnowledgeSourceType(input: string): string {
  const value = input.toLowerCase();
  if (value.includes("faq")) return "faq_knowledge";
  if (value.includes("price")) return "pricing_knowledge";
  return "procedure_knowledge";
}

async function uploadKnowledgeToVm(payload: Record<string, unknown>): Promise<void> {
  const baseUrl = resolveKnowledgeVectorBaseUrl();
  if (!baseUrl) {
    console.error("[KnowledgeBrain Upload] Missing KNOWLEDGE_VECTOR_URL/PHASE_G_URL");
    return;
  }
  const serviceSecret = process.env.PHASE_SERVICE_SECRET?.trim() ?? "";
  try {
    const res = await fetch(`${baseUrl}${KNOWLEDGE_UPLOAD_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": serviceSecret,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const details = await res.text().catch(() => "");
      console.error("[KnowledgeBrain Upload] VM upload failed", res.status, details.slice(0, 300));
    }
  } catch (error) {
    console.error("[KnowledgeBrain Upload] VM upload request error", error);
  }
}

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

/** Create embedding (Phase 14: cache-first) */
export async function embedKnowledgeText(text: string): Promise<number[]> {
  const { getCachedEmbedding, setCachedEmbedding } = await import("@/lib/rag-cache");
  const cached = await getCachedEmbedding(text, EMBEDDING_MODEL);
  if (cached) return cached;

  const openai = getOpenAI();
  if (!openai) throw new Error("OPENAI_API_KEY required");
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8191),
    dimensions: EMBEDDING_DIMENSION,
  });
  const vec = res.data[0]?.embedding;
  if (!vec) throw new Error("No embedding returned");
  void setCachedEmbedding(text, vec, EMBEDDING_MODEL);
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
  const vectorId = `clinic_${clinicDoc.id}`;
  await uploadKnowledgeToVm({
    tenant_id: orgId,
    clinic_id: orgId,
    scope: "clinic",
    source_type: toKnowledgeSourceType(ctx.category),
    content: text,
    topic: ctx.service_name || clinicDoc.id,
    language: "th",
    document_id: vectorId,
    document_version: String(clinicDoc.version ?? 1),
  });

  // DISABLED: Using ChromaDB via VM instead
  // const embedding = await embedKnowledgeText(text);
  // const index = getKnowledgeIndex();
  // const ns = index.namespace(getOrgNamespace(orgId));
  // ... Pinecone upsert removed from indexing path ...
}

/** Upsert global knowledge ลง Pinecone global namespace */
export async function upsertGlobalKnowledgeToVector(
  globalDoc: GlobalKnowledge,
  ctx: StructuredKnowledgeContext
): Promise<void> {
  const text = buildEmbeddableText(ctx);
  await uploadKnowledgeToVm({
    tenant_id: "global",
    clinic_id: "global",
    scope: "clinic",
    source_type: toKnowledgeSourceType(ctx.category),
    content: text,
    topic: ctx.service_name || globalDoc.id,
    language: "th",
    document_id: `global_${globalDoc.id}`,
    document_version: String(globalDoc.version ?? 1),
  });

  // DISABLED: Using ChromaDB via VM instead
  // const embedding = await embedKnowledgeText(text);
  // const index = getKnowledgeIndex();
  // const ns = index.namespace(GLOBAL_NAMESPACE);
  // ... Pinecone upsert removed from indexing path ...
}

/** Delete clinic doc จาก vector (เมื่อ un-approve) */
export async function deleteClinicKnowledgeFromVector(orgId: string, clinicId: string): Promise<void> {
  try {
    await uploadKnowledgeToVm({
      tenant_id: orgId,
      clinic_id: orgId,
      document_id: `clinic_${clinicId}`,
      action: "delete",
    });
  } catch {
    // ignore if not found
  }
}

/**
 * Phase 14: Hard tenant isolation — paranoid check: NEVER return results from wrong org.
 */
function filterByTenantIsolation<T extends { metadata?: Record<string, unknown> }>(
  results: T[],
  expectedOrgId: string
): T[] {
  const filtered: T[] = [];
  for (const r of results) {
    const meta = r.metadata as Record<string, unknown> | undefined;
    const foundOrgId = meta?.org_id ?? meta?.orgId;
    if (foundOrgId !== undefined && foundOrgId !== null && String(foundOrgId) !== expectedOrgId) {
      console.error("TENANT_ISOLATION_VIOLATION", {
        expected: expectedOrgId,
        found: String(foundOrgId),
        resultId: (r as { id?: string }).id,
      });
      continue;
    }
    filtered.push(r);
  }
  return filtered;
}

/** Phase 2 #16: Search result with similarity_score for confidence layer */
export interface KnowledgeSearchHit {
  id: string;
  score?: number;
  metadata?: Record<string, unknown>;
  knowledge_source?: "global" | "clinic" | "merged";
  knowledge_version?: number;
}

/** Search — clinic namespace ก่อน, fallback global. Circuit breaker: skip when Pinecone open. Phase 14: cache */
export async function searchKnowledgeBrain(
  orgId: string,
  query: string,
  topK = 5
): Promise<KnowledgeSearchHit[]> {
  if (isVectorSearchDisabled()) {
    return [];
  }

  const { getCachedRagResults, setCachedRagResults } = await import("@/lib/rag-cache");
  const cached = await getCachedRagResults<KnowledgeSearchHit[]>(orgId, query, "kb");
  if (cached !== null) return cached.slice(0, topK);

  try {
    const serviceSecret = process.env.PHASE_SERVICE_SECRET?.trim() ?? "";
    const baseUrl = resolveKnowledgeVectorBaseUrl();
    if (!baseUrl) return [];
    const res = await fetch(`${baseUrl}${KNOWLEDGE_UPLOAD_PATH.replace("/upload", "/search")}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": serviceSecret,
      },
      body: JSON.stringify({
        tenant_id: orgId,
        clinic_id: orgId,
        query,
        top_k: topK,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const rows = Array.isArray(data?.results) ? data.results : [];
    const combined: KnowledgeSearchHit[] = rows.map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ""),
      score: typeof row.score === "number" ? row.score : undefined,
      metadata: (row.metadata as Record<string, unknown> | undefined) ?? undefined,
      knowledge_source:
        row.knowledge_source === "global" || row.knowledge_source === "clinic"
          ? row.knowledge_source
          : "clinic",
      knowledge_version:
        typeof row.knowledge_version === "number" ? row.knowledge_version : undefined,
    }));

    const verified = filterByTenantIsolation(combined, orgId);
    const result = verified.slice(0, topK);
    void setCachedRagResults(orgId, query, result, "kb");
    recordProviderSuccess("pinecone");
    return result;
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
