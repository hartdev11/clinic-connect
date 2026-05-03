/**
 * E3.5–E3.8 — Embedding & Search
 * E4.1 — Knowledge Pyramid Filter Logic
 * Enterprise: Embedding version drift — เก็บ version ใน metadata, ใช้ versioned namespace
 */
import { getOpenAI } from "@/lib/agents/clients";
import type {
  KnowledgeDocument,
  KnowledgeLevel,
} from "@/types/knowledge";

const EMBEDDING_MODEL = "text-embedding-3-small";
/** เมื่อเปลี่ยน model ต้อง bump version — ใช้ namespace ใหม่หรือ re-embed */
export const EMBEDDING_VERSION = "text-embedding-3-small-v1";
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
    console.error("[Knowledge Upload] Missing KNOWLEDGE_VECTOR_URL/PHASE_G_URL");
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
      console.error("[Knowledge Upload] VM upload failed", res.status, details.slice(0, 300));
    }
  } catch (error) {
    console.error("[Knowledge Upload] VM upload request error", error);
  }
}

async function searchKnowledgeOnVm(payload: Record<string, unknown>): Promise<SearchKnowledgeResult[]> {
  const baseUrl = resolveKnowledgeVectorBaseUrl();
  if (!baseUrl) return [];
  const serviceSecret = process.env.PHASE_SERVICE_SECRET?.trim() ?? "";
  try {
    const res = await fetch(`${baseUrl}/api/knowledge/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": serviceSecret,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const rows = Array.isArray(data?.results) ? data.results : [];
    return rows.map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ""),
      score: typeof row.score === "number" ? row.score : undefined,
      metadata: (row.metadata as Record<string, unknown> | undefined) ?? undefined,
    }));
  } catch {
    return [];
  }
}

async function deleteKnowledgeOnVm(payload: Record<string, unknown>): Promise<void> {
  const baseUrl = resolveKnowledgeVectorBaseUrl();
  if (!baseUrl) return;
  const serviceSecret = process.env.PHASE_SERVICE_SECRET?.trim() ?? "";
  try {
    await fetch(`${baseUrl}/api/knowledge/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": serviceSecret,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignore delete errors in cleanup path
  }
}

/** E3.5 — สร้าง embedding จากข้อความ (Phase 14: cache-first) */
export async function embedText(text: string): Promise<number[]> {
  const { getCachedEmbedding, setCachedEmbedding } = await import("@/lib/rag-cache");
  const cached = await getCachedEmbedding(text, EMBEDDING_MODEL);
  if (cached) return cached;

  const openai = getOpenAI();
  if (!openai) {
    throw new Error("OPENAI_API_KEY is required for embeddings");
  }
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8191),
  });
  const embedding = res.data[0]?.embedding;
  if (!embedding) throw new Error("No embedding returned");
  void setCachedEmbedding(text, embedding, EMBEDDING_MODEL);
  return embedding;
}

/** E3.6 — upsert knowledge document ลง Pinecone (versioned namespace) */
export async function upsertKnowledgeDoc(doc: KnowledgeDocument): Promise<void> {
  await uploadKnowledgeToVm({
    tenant_id: doc.org_id ?? "global",
    clinic_id: doc.org_id ?? "global",
    scope: "clinic",
    source_type: toKnowledgeSourceType(doc.category ?? doc.source ?? "procedure"),
    content: doc.text,
    topic: doc.topic,
    language: "th",
    document_id: doc.id,
    document_version: EMBEDDING_VERSION,
  });

  // DISABLED: Using ChromaDB via VM instead
  // const embedding = await embedText(doc.text);
  // const index = getKnowledgeIndex();
  // const ns = index.namespace(getEmbeddingNamespace());
  // await ns.upsert({
  //   records: [{ id: doc.id, values: embedding, metadata: toPineconeMetadata(doc) }],
  // });
}

/** Enterprise redesign — upsert topic version to Pinecone (async worker). Same namespace + metadata shape as RAG. */
export interface KnowledgeVersionForVector {
  topic: string;
  category: string;
  content: string;
  summary?: string[];
}

export async function upsertKnowledgeVersionToVector(
  orgId: string,
  topicId: string,
  version: KnowledgeVersionForVector
): Promise<void> {
  const text = [version.content]
    .concat((version.summary ?? []).filter(Boolean))
    .join("\n")
    .slice(0, 8191);
  const id = `${orgId}_${topicId}`;
  await uploadKnowledgeToVm({
    tenant_id: orgId,
    clinic_id: orgId,
    scope: "clinic",
    source_type: toKnowledgeSourceType(version.category),
    content: text,
    topic: version.topic,
    language: "th",
    document_id: id,
    document_version: EMBEDDING_VERSION,
  });

  // DISABLED: Using ChromaDB via VM instead
  // const embedding = await embedText(text);
  // const index = getKnowledgeIndex();
  // const ns = index.namespace(getEmbeddingNamespace());
  // const metadata: Record<string, string | number | boolean> = {
  //   level: "org",
  //   org_id: orgId,
  //   topic: version.topic,
  //   category: version.category,
  //   content: version.content.slice(0, 2000),
  //   is_active: true,
  //   source: "knowledge_topics",
  //   embedding_version: EMBEDDING_VERSION,
  // };
  // await ns.upsert({ records: [{ id, values: embedding, metadata }] });
}

/** Phase 16: Upsert learned knowledge (source: human_handoff) */
export async function upsertLearnedKnowledgeToVector(
  orgId: string,
  docId: string,
  topic: string,
  category: string,
  content: string,
  meta?: { handoffId?: string; confidence?: number }
): Promise<void> {
  void meta;
  const text = [content].join("\n").slice(0, 8191);
  const id = `${orgId}_learned_${docId}`;
  await uploadKnowledgeToVm({
    tenant_id: orgId,
    clinic_id: orgId,
    scope: "clinic",
    source_type: toKnowledgeSourceType(category),
    content: text,
    topic,
    language: "th",
    document_id: id,
    document_version: EMBEDDING_VERSION,
  });

  // DISABLED: Using ChromaDB via VM instead
  // const embedding = await embedText(text);
  // const index = getKnowledgeIndex();
  // const ns = index.namespace(getEmbeddingNamespace());
  // const metadata: Record<string, string | number | boolean> = {
  //   level: "org",
  //   org_id: orgId,
  //   topic,
  //   category,
  //   content: content.slice(0, 2000),
  //   is_active: true,
  //   source: "human_handoff",
  //   embedding_version: EMBEDDING_VERSION,
  //   ...(meta?.handoffId && { handoff_id: meta.handoffId }),
  //   ...(typeof meta?.confidence === "number" && { confidence: meta.confidence }),
  // };
  // await ns.upsert({ records: [{ id, values: embedding, metadata }] });
}

/** Phase 16: Remove learned knowledge from Pinecone. */
export async function deleteLearnedKnowledgeFromVector(
  orgId: string,
  docId: string
): Promise<void> {
  await deleteKnowledgeOnVm({
    tenant_id: orgId,
    clinic_id: orgId,
    document_id: `${orgId}_learned_${docId}`,
  });
}

/** Remove topic vector when topic is deleted (multi-tenant safe). */
export async function deleteKnowledgeVectorById(orgId: string, topicId: string): Promise<void> {
  await deleteKnowledgeOnVm({
    tenant_id: orgId,
    clinic_id: orgId,
    document_id: `${orgId}_${topicId}`,
  });
}

/** E4.1 — context สำหรับ pyramid filter */
export interface KnowledgeSearchContext {
  level: KnowledgeLevel;
  org_id?: string;
  branch_id?: string;
}

/** E4.1 — Filter Logic: global→no filter, org→org_id, branch→org_id+branch_id, conversation→org_id(+branch_id) */
export function buildKnowledgePyramidFilter(
  context: KnowledgeSearchContext
): Record<string, unknown> | undefined {
  const { level, org_id, branch_id } = context;

  if (level === "global") {
    return undefined;
  }

  if (level === "org" && org_id) {
    return {
      $or: [
        { level: { $eq: "global" } },
        { $and: [{ level: { $eq: "org" } }, { org_id: { $eq: org_id } }] },
      ],
    };
  }

  if (level === "branch" && org_id && branch_id) {
    return {
      $or: [
        { level: { $eq: "global" } },
        { $and: [{ level: { $eq: "org" } }, { org_id: { $eq: org_id } }] },
        {
          $and: [
            { level: { $eq: "branch" } },
            { org_id: { $eq: org_id } },
            { branch_id: { $eq: branch_id } },
          ],
        },
      ],
    };
  }

  if (level === "conversation" && org_id) {
    const base: Record<string, unknown>[] = [
      { level: { $eq: "global" } },
      { $and: [{ level: { $eq: "org" } }, { org_id: { $eq: org_id } }] },
    ];
    if (branch_id) {
      base.push({
        $and: [
          { level: { $eq: "conversation" } },
          { org_id: { $eq: org_id } },
          { branch_id: { $eq: branch_id } },
        ],
      });
    } else {
      base.push({
        $and: [
          { level: { $eq: "conversation" } },
          { org_id: { $eq: org_id } },
        ],
      });
    }
    return { $or: base };
  }

  return undefined;
}

/**
 * Phase 14: Hard tenant isolation — paranoid check: NEVER return results from wrong org.
 * If metadata.org_id exists and !== expected orgId → DROP and log.
 */
function filterByTenantIsolation<T extends { metadata?: Record<string, unknown> }>(
  results: T[],
  expectedOrgId: string | undefined
): T[] {
  if (!expectedOrgId) return results;
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

/** E3.7–E3.8 — ค้นหา knowledge พร้อม filters */
export interface SearchKnowledgeFilters {
  org_id?: string;
  branch_id?: string;
  category?: string;
  is_active?: boolean;
}

export interface SearchKnowledgeResult {
  id: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export async function searchKnowledge(
  query: string,
  filters?: SearchKnowledgeFilters,
  topK = 5
): Promise<SearchKnowledgeResult[]> {
  const results = await searchKnowledgeOnVm({
    tenant_id: filters?.org_id ?? null,
    clinic_id: filters?.org_id ?? null,
    query,
    top_k: topK,
    filters: {
      org_id: filters?.org_id,
      branch_id: filters?.branch_id,
      category: filters?.category,
      is_active: filters?.is_active,
    },
  });
  return filterByTenantIsolation(results, filters?.org_id);
}

/** E4.1 — ค้นหา knowledge ด้วย pyramid filter ตาม context */
export async function searchKnowledgeWithPyramid(
  query: string,
  context: KnowledgeSearchContext,
  options?: { topK?: number; category?: string; is_active?: boolean }
): Promise<SearchKnowledgeResult[]> {
  const results = await searchKnowledgeOnVm({
    tenant_id: context.org_id ?? null,
    clinic_id: context.org_id ?? null,
    query,
    top_k: options?.topK ?? 5,
    filters: {
      pyramid: buildKnowledgePyramidFilter(context),
      category: options?.category,
      is_active: options?.is_active,
      org_id: context.org_id,
      branch_id: context.branch_id,
    },
  });
  return filterByTenantIsolation(results, context.org_id);
}
