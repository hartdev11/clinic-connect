/**
 * Enterprise Knowledge Brain — Async Embedding Queue
 * Phase 2 #23 + Phase 3 #10: Self-Healing Re-Embed
 * On knowledge update: enqueue → worker re-embeds → atomic upsert (overwrites same ID)
 * Atomic swap: upsert overwrites = zero downtime. Old vector deprecated implicitly.
 * Scalable: BullMQ/Cloud Tasks can run workers horizontally.
 */
import { db } from "@/lib/firebase-admin";
import {
  getClinicKnowledgeById,
  getGlobalKnowledgeById,
  buildStructuredContext,
  upsertClinicKnowledgeToVector,
  upsertGlobalKnowledgeToVector,
} from "@/lib/knowledge-brain";
import type { ClinicKnowledge, GlobalKnowledge } from "@/types/knowledge-brain";

const QUEUE_COLLECTION = "embedding_job_queue";
const PROCESSED_STATUS = "processed";
const PENDING_STATUS = "pending";
const FAILED_STATUS = "failed";
const BATCH_SIZE = 10;

export interface EmbeddingJob {
  id: string;
  type: "clinic" | "global";
  org_id?: string;
  clinic_knowledge_id?: string;
  global_knowledge_id?: string;
  status: string;
  created_at: unknown;
}

/**
 * Enqueue clinic knowledge for embedding
 */
export async function enqueueClinicEmbedding(
  orgId: string,
  clinicKnowledgeId: string
): Promise<string> {
  const doc = await db.collection(QUEUE_COLLECTION).add({
    type: "clinic",
    org_id: orgId,
    clinic_knowledge_id: clinicKnowledgeId,
    status: PENDING_STATUS,
    created_at: new Date(),
  });
  return doc.id;
}

/**
 * Enqueue global knowledge for embedding
 */
export async function enqueueGlobalEmbedding(globalKnowledgeId: string): Promise<string> {
  const doc = await db.collection(QUEUE_COLLECTION).add({
    type: "global",
    global_knowledge_id: globalKnowledgeId,
    status: PENDING_STATUS,
    created_at: new Date(),
  });
  return doc.id;
}

/**
 * Process one job
 */
async function processJob(
  doc: {
    ref: { update: (d: Record<string, unknown>) => Promise<unknown> };
    data: () => Record<string, unknown> | undefined;
  }
): Promise<boolean> {
  const d = doc.data();
  if (!d || d.status !== PENDING_STATUS) return false;

  try {
    if (d.type === "clinic" && d.org_id && d.clinic_knowledge_id) {
      const clinic = await getClinicKnowledgeById(String(d.clinic_knowledge_id), String(d.org_id));
      if (!clinic || clinic.status !== "approved") {
        await doc.ref.update({ status: PROCESSED_STATUS, processed_at: new Date() });
        return true;
      }
      const global = await getGlobalKnowledgeById(clinic.base_service_id);
      if (!global) throw new Error("Global knowledge not found");
      const ctx = buildStructuredContext(global, clinic);
      await upsertClinicKnowledgeToVector(String(d.org_id), clinic, global, ctx);
      // Phase 3 #10: Audit re-embed for traceability
      await db.collection("vector_reembed_audit").add({
        type: "clinic",
        org_id: d.org_id,
        clinic_knowledge_id: d.clinic_knowledge_id,
        knowledge_version: clinic.version,
        created_at: new Date(),
      });
    } else if (d.type === "global" && d.global_knowledge_id) {
      const global = await getGlobalKnowledgeById(String(d.global_knowledge_id));
      if (!global || !global.approved) {
        await doc.ref.update({ status: PROCESSED_STATUS, processed_at: new Date() });
        return true;
      }
      const ctx = buildStructuredContext(global, null);
      await upsertGlobalKnowledgeToVector(global, ctx);
      await db.collection("vector_reembed_audit").add({
        type: "global",
        global_knowledge_id: d.global_knowledge_id,
        knowledge_version: global.version,
        created_at: new Date(),
      });
    } else {
      await doc.ref.update({ status: FAILED_STATUS, error: "Invalid job" });
      return false;
    }

    await doc.ref.update({ status: PROCESSED_STATUS, processed_at: new Date() });
    return true;
  } catch (err) {
    await doc.ref.update({
      status: FAILED_STATUS,
      error: (err as Error)?.message?.slice(0, 200),
      processed_at: new Date(),
    });
    return false;
  }
}

/**
 * Process up to BATCH_SIZE pending jobs
 */
export async function processEmbeddingQueue(): Promise<{ processed: number; failed: number }> {
  const snap = await db
    .collection(QUEUE_COLLECTION)
    .where("status", "==", PENDING_STATUS)
    .orderBy("created_at", "asc")
    .limit(BATCH_SIZE)
    .get();

  let processed = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const ok = await processJob(doc);
    if (ok) processed++;
    else failed++;
  }

  return { processed, failed };
}
