/**
 * AI Feedback Loop — Enterprise Self-Improvement
 * - High-confidence response caching
 * - Failure tagging
 * - Auto-label hallucination
 * - Feedback aggregation for prompt improvement
 */
import { createHash } from "crypto";
import { db } from "@/lib/firebase-admin";
import { checkPolicyViolation } from "./ai-observability";

const CACHE_COLLECTION = "ai_response_cache";
const FEEDBACK_AGGREGATION_COLLECTION = "ai_feedback_aggregates";
const CACHE_TTL_HOURS = 24;
const MIN_CACHE_CONFIDENCE = 0.85;
const HALLUCINATION_PATTERNS = [
  /\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*บาท/,  // ตัวเลขเงินที่อาจแต่งขึ้น
  /\d{1,2}\s*(?:ครั้ง|รอบ|ครั้ง\/เดือน)/,  // frequency claims
  /รับประกัน\s*(?:ผล|100%|แน่นอน)/i,
  /ปลอดภัย\s*100%|ปลอดภัยแน่นอน/i,
  /วินิจฉัยว่า|วินิจฉัยได้ว่า/i,
  /ถูกกฎหมายแน่นอน|ชอบด้วยกฎหมายแน่นอน/i,
];

function hash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 24);
}

export interface CacheLookupInput {
  org_id: string;
  userMessage: string;
}

export interface CacheStoreInput {
  org_id: string;
  userMessage: string;
  reply: string;
  confidence: number;
  correlationId?: string;
}

/** High-confidence cache — lookup ก่อนเรียก LLM */
export async function getCachedResponse(
  input: CacheLookupInput
): Promise<string | null> {
  const key = hash(`${input.org_id}:${input.userMessage.trim().toLowerCase()}`);
  const snap = await db
    .collection(CACHE_COLLECTION)
    .where("cache_key", "==", key)
    .where("org_id", "==", input.org_id)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const d = snap.docs[0]!.data();
  const expiresAt = d.expires_at?.toMillis?.() ?? new Date(d.expires_at).getTime();
  if (expiresAt < Date.now()) return null;
  return d.reply ?? null;
}

/** Enterprise: Cache invalidation — เรียกเมื่อ knowledge/promo/prompt เปลี่ยน */
export async function invalidateAICache(opts?: {
  org_id?: string;
  scope?: "all" | "org" | "knowledge" | "promo";
}): Promise<number> {
  let q = db.collection(CACHE_COLLECTION);
  if (opts?.org_id) {
    q = q.where("org_id", "==", opts.org_id) as typeof q;
  }
  const snap = await q.get();
  if (snap.empty) return 0;
  const BATCH_SIZE = 500;
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = snap.docs.slice(i, i + BATCH_SIZE);
    for (const doc of chunk) {
      batch.delete(doc.ref);
      deleted++;
    }
    await batch.commit();
  }
  return deleted;
}

/** Cache response เมื่อ confidence สูง */
export async function setCachedResponse(input: CacheStoreInput): Promise<void> {
  if (input.confidence < MIN_CACHE_CONFIDENCE) return;
  const key = hash(`${input.org_id}:${input.userMessage.trim().toLowerCase()}`);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 3600 * 1000);

  await db.collection(CACHE_COLLECTION).doc(key).set(
    {
      org_id: input.org_id,
      cache_key: key,
      reply: input.reply,
      confidence: input.confidence,
      expires_at: expiresAt,
      created_at: now,
      correlation_id: input.correlationId ?? null,
    },
    { merge: true }
  );
}

/** คำนวณ confidence จาก analytics context (จำนวน keyFindings, recommendation) */
export function computeReplyConfidence(
  analyticsRich: boolean,
  policyViolation: boolean
): number {
  if (policyViolation) return 0;
  return analyticsRich ? 0.9 : 0.7;
}

/** Auto-label hallucination — heuristic check */
export function checkHallucination(reply: string): boolean {
  const policyViolation = checkPolicyViolation(reply);
  if (policyViolation) return true;
  for (const p of HALLUCINATION_PATTERNS) {
    if (p.test(reply)) return true;
  }
  return false;
}

/** Failure tagging — บันทึกเมื่อ AI fail / policy violation */
export async function tagFailure(params: {
  org_id: string;
  correlation_id?: string;
  failure_type: "policy_violation" | "hallucination" | "llm_error" | "timeout";
  reply?: string;
  user_message?: string;
}): Promise<void> {
  await db.collection("ai_failure_tags").add({
    org_id: params.org_id,
    correlation_id: params.correlation_id ?? null,
    failure_type: params.failure_type,
    reply: params.reply?.slice(0, 500) ?? null,
    user_message: params.user_message?.slice(0, 300) ?? null,
    created_at: new Date(),
  });
}

/** Record feedback สำหรับ prompt improvement — เมื่อ admin label success/fail */
export async function recordFeedbackForPromptImprovement(params: {
  org_id: string;
  feedback_id: string;
  admin_label: "success" | "fail";
  user_message: string;
  bot_reply: string;
  admin_user_id?: string;
  /** Phase 2 #20: สำหรับ trace knowledge_version เมื่อ fail */
  correlation_id?: string;
}): Promise<void> {
  await db.collection(FEEDBACK_AGGREGATION_COLLECTION).add({
    org_id: params.org_id,
    feedback_id: params.feedback_id,
    admin_label: params.admin_label,
    user_message: params.user_message.slice(0, 500),
    bot_reply: params.bot_reply.slice(0, 500),
    admin_user_id: params.admin_user_id ?? null,
    correlation_id: params.correlation_id ?? null,
    created_at: new Date(),
  });

  if (params.admin_label === "fail" && params.correlation_id) {
    void applyKnowledgeFailureFeedback(params.org_id, params.correlation_id);
  }
}

/** Phase 2 #20: เมื่อ admin label fail — trace knowledge_version, increment failure_count, auto-flag */
const FAILURE_RATE_THRESHOLD = 0.1; // 10%
const MIN_FAILURES_FOR_REVIEW = 2;

async function applyKnowledgeFailureFeedback(orgId: string, correlationId: string): Promise<void> {
  try {
    const snap = await db
      .collection("ai_activity_logs")
      .where("org_id", "==", orgId)
      .where("correlation_id", "==", correlationId)
      .limit(1)
      .get();

    if (snap.empty) return;
    const ids = snap.docs[0]?.data()?.retrieval_knowledge_ids as string[] | undefined;
    if (!ids?.length) return;

    const clinicCol = db.collection("clinic_knowledge");
    const now = new Date().toISOString();

    for (const rawId of ids) {
      const docId = rawId.startsWith("clinic_") ? rawId.replace("clinic_", "") : rawId;
      const docRef = clinicCol.doc(docId);
      const doc = await docRef.get();
      if (!doc.exists) continue;
      const d = doc.data()!;
      if (d.org_id !== orgId) continue;

      const currentFail = typeof d.failure_count === "number" ? d.failure_count : 0;
      const newFail = currentFail + 1;

      await docRef.update({
        failure_count: newFail,
        last_failure_at: now,
        updated_at: now,
      });

      if (newFail >= MIN_FAILURES_FOR_REVIEW) {
        await docRef.update({ status: "needs_review" });
      }
    }
  } catch (err) {
    console.warn("[AI Feedback] applyKnowledgeFailureFeedback:", (err as Error)?.message?.slice(0, 80));
  }
}

/** ดึง feedback aggregates สำหรับ prompt tuning — success vs fail ratio ต่อ pattern */
export async function getFeedbackSummaryForPrompt(
  org_id: string,
  limit = 100
): Promise<{ success_count: number; fail_count: number; recent_fails: string[] }> {
  const snap = await db
    .collection(FEEDBACK_AGGREGATION_COLLECTION)
    .where("org_id", "==", org_id)
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();

  let success_count = 0;
  let fail_count = 0;
  const recent_fails: string[] = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.admin_label === "success") success_count++;
    else if (d.admin_label === "fail") {
      fail_count++;
      if (recent_fails.length < 10 && d.user_message) {
        recent_fails.push(d.user_message);
      }
    }
  }

  return { success_count, fail_count, recent_fails };
}
