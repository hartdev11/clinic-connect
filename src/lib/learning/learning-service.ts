/**
 * Phase 16 — Learning Service
 * Save learned items to Firestore + Pinecone (versioned)
 */
import { db } from "@/lib/firebase-admin";
import {
  upsertLearnedKnowledgeToVector,
  searchKnowledge,
  deleteLearnedKnowledgeFromVector,
} from "@/lib/knowledge-vector";
import { invalidateOrgCache } from "@/lib/ai/prompt-cache-manager";
import { invalidateOrgRagCache } from "@/lib/rag-cache";
import type { KnowledgeItem } from "./knowledge-extractor";
import { formatQAKnowledge, formatPricingKnowledge } from "./knowledge-extractor";

const LEARNED_COLLECTION = "learned_knowledge";

export interface LearnedItemDoc {
  id: string;
  orgId: string;
  type: "qa" | "pricing";
  topic: string;
  category: string;
  content: string;
  source: "human_handoff";
  handoffId: string;
  learnedAt: string;
  confidence: number;
  question?: string;
  answer?: string;
  service?: string;
  price?: string;
  previousContent?: string;
  updatedAt: string;
}

/** Check similarity — returns learned doc id only if similar item is from learned_knowledge */
export async function findSimilarLearned(orgId: string, text: string): Promise<{ id: string; score: number } | null> {
  const results = await searchKnowledge(text, { org_id: orgId, is_active: true }, 5);
  for (const r of results) {
    if (typeof r.score !== "number" || r.score < 0.85) continue;
    const fullId = r.id;
    const meta = r.metadata as { source?: string } | undefined;
    if (meta?.source === "human_handoff" && fullId.startsWith(`${orgId}_learned_`)) {
      return { id: fullId.slice(`${orgId}_learned_`.length), score: r.score };
    }
  }
  return null;
}

/** Get existing price for service from learned + clinic knowledge */
export async function getExistingPrice(orgId: string, service: string): Promise<number | null> {
  const results = await searchKnowledge(`${service} ราคา`, { org_id: orgId }, 5);
  for (const r of results) {
    const meta = r.metadata;
    const content = (meta?.content as string) ?? "";
    const match = content.match(/(\d[\d,]*)\s*บาท/);
    if (match) return parseInt(match[1].replace(/,/g, ""), 10);
  }
  return null;
}

/** Save learned item — create new or update existing (pricing) */
export async function saveLearnedItem(
  orgId: string,
  item: KnowledgeItem,
  handoffId: string,
  excludeIds?: string[]
): Promise<{ id: string; action: "created" | "updated" }> {
  const now = new Date().toISOString();
  const col = db.collection("organizations").doc(orgId).collection(LEARNED_COLLECTION);

  let content = "";
  let topic = "";
  let category = "faq";

  if (item.type === "qa" && item.question && item.answer) {
    content = formatQAKnowledge(item);
    topic = item.question.slice(0, 80);
  } else if (item.type === "pricing" && item.service && item.price) {
    content = formatPricingKnowledge(item);
    topic = `${item.service} ราคา`;
    category = "price";
  } else {
    throw new Error("Invalid knowledge item");
  }

  const similar = await findSimilarLearned(orgId, content);
  const existingId =
    similar && (similar.score ?? 0) >= 0.85 && !excludeIds?.includes(similar.id) ? similar.id : null;

  if (existingId && item.type === "pricing") {
    const existingDoc = await col.doc(existingId).get();
    if (existingDoc.exists) {
      const d = existingDoc.data()!;
      const oldContent = (d.content as string) ?? "";
      await existingDoc.ref.update({
        content,
        topic,
        category,
        previousContent: oldContent,
        updatedAt: now,
        handoffId,
        confidence: item.confidence,
      });
      await upsertLearnedKnowledgeToVector(orgId, existingId, topic, category, content, {
        handoffId,
        confidence: item.confidence,
      });
      void invalidateOrgCache(orgId);
      void invalidateOrgRagCache(orgId);
      return { id: existingId, action: "updated" };
    }
  }

  const ref = col.doc();
  await ref.set({
    orgId,
    type: item.type,
    topic,
    category,
    content,
    source: "human_handoff",
    handoffId,
    learnedAt: now,
    confidence: item.confidence,
    question: item.question ?? null,
    answer: item.answer ?? null,
    service: item.service ?? null,
    price: item.price ?? null,
    updatedAt: now,
  });

  await upsertLearnedKnowledgeToVector(orgId, ref.id, topic, category, content, {
    handoffId,
    confidence: item.confidence,
  });
  void invalidateOrgCache(orgId);
  void invalidateOrgRagCache(orgId);
  return { id: ref.id, action: "created" };
}

const LEARNING_LOG_COLLECTION = "learning_log";

export interface LearningLogEntry {
  id: string;
  question: string;
  answer: string;
  qualityScore: number;
  decision: "auto_approve" | "queue" | "reject";
  reason: string;
  handoffId: string;
  evaluatedAt: string;
  learnedId?: string | null;
}

/** Phase 24: Log evaluated Q&A to learning_log */
export async function logLearningEvaluation(
  orgId: string,
  params: {
    question: string;
    answer: string;
    qualityScore: number;
    decision: "auto_approve" | "queue" | "reject";
    reason: string;
    handoffId: string;
    learnedId?: string | null;
  }
): Promise<string> {
  const now = new Date().toISOString();
  const ref = db
    .collection("organizations")
    .doc(orgId)
    .collection(LEARNING_LOG_COLLECTION)
    .doc();
  await ref.set({
    question: params.question,
    answer: params.answer,
    qualityScore: params.qualityScore,
    decision: params.decision,
    reason: params.reason,
    handoffId: params.handoffId,
    evaluatedAt: now,
    learnedId: params.learnedId ?? null,
  });
  return ref.id;
}

/** Phase 16: Remove learned item from Firestore + Pinecone (for dashboard "ลบออก") */
export async function deleteLearnedItem(orgId: string, docId: string): Promise<void> {
  const col = db.collection("organizations").doc(orgId).collection(LEARNED_COLLECTION);
  const ref = col.doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return;
  await ref.delete();
  await deleteLearnedKnowledgeFromVector(orgId, docId);
  void invalidateOrgCache(orgId);
  void invalidateOrgRagCache(orgId);
}
