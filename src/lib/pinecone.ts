/**
 * E3.1–E3.2 — Pinecone Setup
 * Client + Index config + Namespace สำหรับ knowledge
 * Enterprise DR: PINECONE_FAILOVER_INDEX for region failover
 */
import { Pinecone } from "@pinecone-database/pinecone";

export const PINECONE_INDEX_NAME =
  process.env.PINECONE_INDEX_NAME ?? "clinic-knowledge";

/** Failover index — restore from backup in secondary region, then set this env */
export const PINECONE_FAILOVER_INDEX = process.env.PINECONE_FAILOVER_INDEX ?? "";

/** Controller host override for region failover (optional) */
export const PINECONE_CONTROLLER_HOST = process.env.PINECONE_CONTROLLER_HOST ?? "";

export const PINECONE_NAMESPACE_KNOWLEDGE = "knowledge";

/** Enterprise: Embedding version — เมื่อเปลี่ยน model ใช้ namespace ใหม่. ว่าง = backward compat (knowledge) */
export const EMBEDDING_NAMESPACE_VERSION = process.env.EMBEDDING_NAMESPACE_VERSION ?? "";

/** Namespace สำหรับ knowledge — versioned เพื่อรองรับ embedding drift */
export function getEmbeddingNamespace(): string {
  if (!EMBEDDING_NAMESPACE_VERSION) return PINECONE_NAMESPACE_KNOWLEDGE;
  return `${PINECONE_NAMESPACE_KNOWLEDGE}_${EMBEDDING_NAMESPACE_VERSION}`;
}

/** dimension สำหรับ OpenAI text-embedding-3-small / text-embedding-ada-002 */
export const EMBEDDING_DIMENSION = 1536;

let client: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (!client) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY is required for Pinecone");
    }
    client = new Pinecone({ apiKey });
  }
  return client;
}

export function getKnowledgeIndex() {
  const pc = getPineconeClient();
  return pc.index(PINECONE_INDEX_NAME);
}

/** Use failover index when primary region down — requires backup restored to failover index */
export function getKnowledgeIndexWithFailover() {
  const idx = PINECONE_FAILOVER_INDEX || PINECONE_INDEX_NAME;
  return getPineconeClient().index(idx);
}
