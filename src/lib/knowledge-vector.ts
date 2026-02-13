/**
 * E3.5–E3.8 — Embedding & Search
 * E4.1 — Knowledge Pyramid Filter Logic
 * Enterprise: Embedding version drift — เก็บ version ใน metadata, ใช้ versioned namespace
 */
import { getOpenAI } from "@/lib/agents/clients";
import { getKnowledgeIndex, getEmbeddingNamespace } from "@/lib/pinecone";
import type {
  KnowledgeDocument,
  KnowledgeLevel,
} from "@/types/knowledge";

const EMBEDDING_MODEL = "text-embedding-3-small";
/** เมื่อเปลี่ยน model ต้อง bump version — ใช้ namespace ใหม่หรือ re-embed */
export const EMBEDDING_VERSION = "text-embedding-3-small-v1";

/** E3.5 — สร้าง embedding จากข้อความ */
export async function embedText(text: string): Promise<number[]> {
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
  return embedding;
}

function toPineconeMetadata(doc: KnowledgeDocument): Record<string, string | number | boolean> {
  const m: Record<string, string | number | boolean> = {
    level: doc.level,
    topic: doc.topic,
    category: doc.category,
    key_points: JSON.stringify(doc.key_points),
    is_active: doc.is_active,
    source: doc.source,
    content: doc.text.slice(0, 2000), // E4 RAG: เก็บ content สำหรับ retrieve
    embedding_version: EMBEDDING_VERSION, // Enterprise: drift tracking
  };
  if (doc.org_id) m.org_id = doc.org_id;
  if (doc.branch_id) m.branch_id = doc.branch_id;
  if (doc.expires_at) m.expires_at = doc.expires_at;
  if (doc.archived_at) m.archived_at = doc.archived_at;
  return m;
}

/** E3.6 — upsert knowledge document ลง Pinecone (versioned namespace) */
export async function upsertKnowledgeDoc(doc: KnowledgeDocument): Promise<void> {
  const embedding = await embedText(doc.text);
  const index = getKnowledgeIndex();
  const ns = index.namespace(getEmbeddingNamespace());

  await ns.upsert({
    records: [
      {
        id: doc.id,
        values: embedding,
        metadata: toPineconeMetadata(doc),
      },
    ],
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
  const embedding = await embedText(query);
  const index = getKnowledgeIndex();
  const ns = index.namespace(getEmbeddingNamespace());

  const filter: Record<string, unknown> = {};
  if (filters?.org_id) filter.org_id = { $eq: filters.org_id };
  if (filters?.branch_id) filter.branch_id = { $eq: filters.branch_id };
  if (filters?.category) filter.category = { $eq: filters.category };
  if (filters?.is_active !== undefined) filter.is_active = { $eq: filters.is_active };

  const res = await ns.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  return (res.matches ?? []).map((m) => ({
    id: m.id ?? "",
    score: m.score,
    metadata: m.metadata as Record<string, unknown> | undefined,
  }));
}

/** E4.1 — ค้นหา knowledge ด้วย pyramid filter ตาม context */
export async function searchKnowledgeWithPyramid(
  query: string,
  context: KnowledgeSearchContext,
  options?: { topK?: number; category?: string; is_active?: boolean }
): Promise<SearchKnowledgeResult[]> {
  const embedding = await embedText(query);
  const index = getKnowledgeIndex();
  const ns = index.namespace(getEmbeddingNamespace());

  const pyramidFilter = buildKnowledgePyramidFilter(context);
  const extra: Record<string, unknown>[] = [];
  if (options?.category) extra.push({ category: { $eq: options.category } });
  if (options?.is_active !== undefined) extra.push({ is_active: { $eq: options.is_active } });

  let filter: Record<string, unknown> | undefined;
  if (pyramidFilter) extra.unshift(pyramidFilter);
  if (extra.length > 0) filter = extra.length === 1 ? extra[0] : { $and: extra };

  const res = await ns.query({
    vector: embedding,
    topK: options?.topK ?? 5,
    includeMetadata: true,
    filter,
  });

  return (res.matches ?? []).map((m) => ({
    id: m.id ?? "",
    score: m.score,
    metadata: m.metadata as Record<string, unknown> | undefined,
  }));
}
