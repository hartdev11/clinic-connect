/**
 * Enterprise — Hybrid weighted RAG retrieval
 * Improves answer precision: similarity + exact topic match + category boost.
 * Deterministic, explainable. No ML training.
 * Inject through knowledge agent only — do not modify orchestrator.
 */
import { searchKnowledge } from "@/lib/knowledge-vector";

/**
 * ขยาย query สำหรับ body part — ปาก→lip filler, คาง→chin filler
 * เพื่อให้ RAG ดึงผลตรงประเด็น (ไม่ดึง เลเซอร์ รีจูรัน ที่ไม่เกี่ยวกับปาก)
 */
export function expandRagQueryForBodyPart(message: string): string {
  const m = message.toLowerCase().trim();
  const expansions: string[] = [];
  if (/ปาก|ทำปาก|ฉีดปาก|ปากอิ่ม|เติมปาก|เสริมปาก/.test(m)) {
    expansions.push("lip filler ฟิลเลอร์ปาก lip filler ปาก");
  }
  if (/คาง|ทำคาง|คางเหลี่ยม|เสริมคาง|ฉีดคาง/.test(m)) {
    expansions.push("chin filler ฟิลเลอร์คาง คางเหลี่ยม");
  }
  if (/จมูก|ทำจมูก|เสริมจมูก|แก้จมูก|ฟิลเลอร์จมูก/.test(m)) {
    expansions.push("nose surgery เสริมจมูก ฟิลเลอร์จมูก");
  }
  if (/โหนกแก้ม|แก้ม|ทำแก้ม|ฉีดแก้ม|เสริมแก้ม/.test(m)) {
    expansions.push("cheek filler ฟิลเลอร์แก้ม โหนกแก้ม");
  }
  if (/ใต้ตา|ร่องแก้ม|ร่องน้ำตา/.test(m)) {
    expansions.push("under eye filler ฟิลเลอร์ใต้ตา ร่องแก้ม");
  }
  if (/กราม|ขากรรไกร|ทำกราม/.test(m)) {
    expansions.push("jaw filler ฟิลเลอร์กราม jawline");
  }
  if (expansions.length === 0) return message;
  return `${message} ${expansions.join(" ")}`;
}
import type { SearchKnowledgeResult } from "@/lib/knowledge-vector";

const MAX_CHUNKS = 5;
const FETCH_TOP_K = 10;

/** Similarity weight; rest = exact match + category boost */
const SIMILARITY_WEIGHT = 0.7;
const EXACT_TOPIC_MATCH_BOOST = 0.2;
const CATEGORY_MATCH_BOOST = 0.1;

const PRICE_KEYWORDS = [
  "ราคา",
  "กี่บาท",
  "เท่าไหร่",
  "ค่าใช้จ่าย",
  "แพง",
  "ถูก",
  "price",
  "cost",
  "บาท",
  "เริ่มต้น",
];

const QUESTION_PATTERNS = [
  /^(how|when|where|what|why|does|is|are|can|do)\s/i,
  /ไหม\s*$/,
  /หรือยัง\s*$/,
  /อย่างไร\s*$/,
  /หรือเปล่า\s*$/,
  /\?$/,
];

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasPriceIntent(query: string): boolean {
  const q = normalizeForMatch(query);
  return PRICE_KEYWORDS.some((k) => q.includes(k.toLowerCase()));
}

function hasQuestionFormat(query: string): boolean {
  const q = query.trim();
  return QUESTION_PATTERNS.some((p) => p.test(q));
}

function exactTopicMatch(query: string, topic: string): boolean {
  if (!topic?.trim()) return false;
  const q = normalizeForMatch(query);
  const t = normalizeForMatch(topic);
  return q.includes(t) || t.includes(q);
}

export interface RetrievedChunk {
  id: string;
  score: number;
  finalScore: number;
  metadata?: Record<string, unknown>;
}

/**
 * Retrieve knowledge context for org + query with hybrid weighted scoring.
 * Filter: orgId, status == active. Max 5 chunks. Phase 14: cache.
 */
export async function retrieveKnowledgeContext(
  orgId: string,
  query: string
): Promise<RetrievedChunk[]> {
  const expandedQuery = expandRagQueryForBodyPart(query);
  const { getCachedRagResults, setCachedRagResults } = await import("@/lib/rag-cache");
  const cached = await getCachedRagResults<RetrievedChunk[]>(orgId, expandedQuery, "topics");
  if (cached !== null) return cached;

  const raw = await searchKnowledge(expandedQuery, {
    org_id: orgId,
    is_active: true,
  }, FETCH_TOP_K);

  const priceBoost = hasPriceIntent(query);
  const questionBoost = hasQuestionFormat(query);

  const scored: RetrievedChunk[] = raw.map((r) => {
    const similarityScore = typeof r.score === "number" ? Math.max(0, Math.min(1, r.score)) : 0.5;
    const topic = (r.metadata?.topic as string) ?? "";
    const category = (r.metadata?.category as string) ?? "";

    let exactTopic = 0;
    if (exactTopicMatch(expandedQuery, topic)) exactTopic = EXACT_TOPIC_MATCH_BOOST;

    let categoryBoost = 0;
    if (priceBoost && category === "price") categoryBoost = CATEGORY_MATCH_BOOST;
    else if (questionBoost && category === "faq") categoryBoost = CATEGORY_MATCH_BOOST;
    else if (category && !priceBoost && !questionBoost) categoryBoost = 0;

    const finalScore =
      similarityScore * SIMILARITY_WEIGHT + exactTopic + categoryBoost;

    return {
      id: r.id,
      score: similarityScore,
      finalScore,
      metadata: r.metadata,
    };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  const result = scored.slice(0, MAX_CHUNKS);
  void setCachedRagResults(orgId, expandedQuery, result, "topics");
  return result;
}
