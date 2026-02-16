/**
 * Enterprise Knowledge Brain — Async Embedding Queue
 * Phase 2 #23 + Phase 3 #10: Self-Healing Re-Embed
 * On knowledge update: enqueue → worker re-embeds → atomic upsert (overwrites same ID)
 * Atomic swap: upsert overwrites = zero downtime. Old vector deprecated implicitly.
 * Scalable: BullMQ/Cloud Tasks can run workers horizontally.
 * Knowledge topics: type "knowledge_version" — org-scoped, no inline embed in request.
 */
import { db } from "@/lib/firebase-admin";
import {
  getClinicKnowledgeById,
  getGlobalKnowledgeById,
  buildStructuredContext,
  upsertClinicKnowledgeToVector,
  upsertGlobalKnowledgeToVector,
} from "@/lib/knowledge-brain";
import {
  getKnowledgeVersion,
  setActiveVersionAndArchivePrevious,
  markVersionFailed,
} from "@/lib/knowledge-topics-data";
import { upsertKnowledgeVersionToVector } from "@/lib/knowledge-vector";
import {
  getClinicServiceById,
  getClinicFaqById,
  getGlobalServiceById,
  setClinicServiceEmbeddingSuccess,
  setClinicFaqEmbeddingSuccess,
  markClinicServiceEmbeddingFailed,
  markClinicFaqEmbeddingFailed,
} from "@/lib/unified-knowledge/data";
import {
  upsertUnifiedServiceToVector,
  upsertUnifiedFaqToVector,
} from "@/lib/unified-knowledge/vector";
import type { ClinicKnowledge, GlobalKnowledge } from "@/types/knowledge-brain";

const QUEUE_COLLECTION = "embedding_job_queue";
const PROCESSED_STATUS = "processed";
const PENDING_STATUS = "pending";
const FAILED_STATUS = "failed";
const DEAD_LETTER_STATUS = "dead_letter";
const BATCH_SIZE = 10;
const MAX_RETRIES = 3;

export interface EmbeddingJob {
  id: string;
  type: "clinic" | "global" | "knowledge_version" | "unified_service" | "unified_faq";
  org_id?: string;
  clinic_knowledge_id?: string;
  global_knowledge_id?: string;
  version_id?: string;
  unified_service_id?: string;
  unified_faq_id?: string;
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
 * Enqueue knowledge topic version for embedding (async, no inline embed).
 * Worker will embed, upsert to Pinecone, then mark version active and previous archived.
 */
export async function enqueueKnowledgeVersionEmbed(
  orgId: string,
  versionId: string
): Promise<string> {
  const doc = await db.collection(QUEUE_COLLECTION).add({
    type: "knowledge_version",
    org_id: orgId,
    version_id: versionId,
    status: PENDING_STATUS,
    created_at: new Date(),
  });
  return doc.id;
}

/**
 * Enqueue unified clinic service for embedding (async, no blocking).
 * Idempotent: skip if pending job already exists for same entity.
 */
export async function enqueueUnifiedServiceEmbed(
  orgId: string,
  clinicServiceId: string
): Promise<string> {
  const existing = await db
    .collection(QUEUE_COLLECTION)
    .where("type", "==", "unified_service")
    .where("org_id", "==", orgId)
    .where("unified_service_id", "==", clinicServiceId)
    .where("status", "==", PENDING_STATUS)
    .limit(1)
    .get();
  if (!existing.empty) return existing.docs[0]!.id;
  const doc = await db.collection(QUEUE_COLLECTION).add({
    type: "unified_service",
    org_id: orgId,
    unified_service_id: clinicServiceId,
    status: PENDING_STATUS,
    retry_count: 0,
    next_retry_at: null,
    created_at: new Date(),
  });
  return doc.id;
}

/**
 * Enqueue unified clinic FAQ for embedding (async). Idempotent per entity.
 */
export async function enqueueUnifiedFaqEmbed(orgId: string, faqId: string): Promise<string> {
  const existing = await db
    .collection(QUEUE_COLLECTION)
    .where("type", "==", "unified_faq")
    .where("org_id", "==", orgId)
    .where("unified_faq_id", "==", faqId)
    .where("status", "==", PENDING_STATUS)
    .limit(1)
    .get();
  if (!existing.empty) return existing.docs[0]!.id;
  const doc = await db.collection(QUEUE_COLLECTION).add({
    type: "unified_faq",
    org_id: orgId,
    unified_faq_id: faqId,
    status: PENDING_STATUS,
    retry_count: 0,
    next_retry_at: null,
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
    } else if (d.type === "knowledge_version" && d.org_id && d.version_id) {
      const orgId = String(d.org_id);
      const versionId = String(d.version_id);
      const version = await getKnowledgeVersion(orgId, versionId);
      if (!version || version.status !== "updating") {
        await doc.ref.update({ status: PROCESSED_STATUS, processed_at: new Date() });
        return true;
      }
      await upsertKnowledgeVersionToVector(orgId, version.topicId, {
        topic: version.topic,
        category: version.category,
        content: version.content,
        summary: version.summary,
      });
      await setActiveVersionAndArchivePrevious(orgId, version.topicId, versionId);
    } else if (d.type === "unified_service" && d.org_id && d.unified_service_id) {
      const orgId = String(d.org_id);
      const serviceId = String(d.unified_service_id);
      const service = await getClinicServiceById(orgId, serviceId);
      if (!service || service.deleted_at) {
        await doc.ref.update({ status: PROCESSED_STATUS, processed_at: new Date() });
        return true;
      }
      if (service.status !== "active" && service.status !== "embedding_failed") {
        await doc.ref.update({ status: PROCESSED_STATUS, processed_at: new Date() });
        return true;
      }
      const global = service.global_service_id
        ? await getGlobalServiceById(service.global_service_id)
        : null;
      await upsertUnifiedServiceToVector(orgId, service, global);
      await setClinicServiceEmbeddingSuccess(orgId, serviceId, global?.version ?? 0);
    } else if (d.type === "unified_faq" && d.org_id && d.unified_faq_id) {
      const orgId = String(d.org_id);
      const faqId = String(d.unified_faq_id);
      const faq = await getClinicFaqById(orgId, faqId);
      if (!faq || faq.deleted_at) {
        await doc.ref.update({ status: PROCESSED_STATUS, processed_at: new Date() });
        return true;
      }
      await upsertUnifiedFaqToVector(orgId, faq);
      await setClinicFaqEmbeddingSuccess(orgId, faqId);
    } else {
      await doc.ref.update({ status: FAILED_STATUS, error: "Invalid job" });
      return false;
    }

    await doc.ref.update({ status: PROCESSED_STATUS, processed_at: new Date() });
    return true;
  } catch (err) {
    const msg = (err as Error)?.message?.slice(0, 200);
    const d = doc.data();
    const isUnifiedService = d?.type === "unified_service" && d?.org_id && d?.unified_service_id;
    const isUnifiedFaq = d?.type === "unified_faq" && d?.org_id && d?.unified_faq_id;

    if (isUnifiedService || isUnifiedFaq) {
      const retryCount = (typeof d?.retry_count === "number" ? d.retry_count : 0) + 1;
      if (retryCount >= MAX_RETRIES) {
        await doc.ref.update({
          status: DEAD_LETTER_STATUS,
          error: msg,
          retry_count: retryCount,
          processed_at: new Date(),
        });
        if (isUnifiedService) {
          await markClinicServiceEmbeddingFailed(String(d!.org_id), String(d!.unified_service_id));
        } else {
          await markClinicFaqEmbeddingFailed(String(d!.org_id), String(d!.unified_faq_id));
        }
      } else {
        const backoffMs = Math.min(2 ** retryCount * 1000, 60000);
        await doc.ref.update({
          retry_count: retryCount,
          next_retry_at: new Date(Date.now() + backoffMs),
          error: msg,
          status: PENDING_STATUS,
        });
      }
      return false;
    }

    await doc.ref.update({
      status: FAILED_STATUS,
      error: msg,
      processed_at: new Date(),
    });
    if (d?.type === "knowledge_version" && d?.org_id && d?.version_id) {
      await markVersionFailed(String(d.org_id), String(d.version_id));
    }
    return false;
  }
}

/**
 * Process up to BATCH_SIZE pending jobs.
 * Includes jobs with next_retry_at <= now (exponential backoff).
 */
export async function processEmbeddingQueue(): Promise<{ processed: number; failed: number }> {
  const snap = await db
    .collection(QUEUE_COLLECTION)
    .where("status", "==", PENDING_STATUS)
    .orderBy("created_at", "asc")
    .limit(BATCH_SIZE * 2)
    .get();

  const now = Date.now();
  const docs = snap.docs.filter((doc) => {
    const d = doc.data();
    const next = d?.next_retry_at;
    if (next == null) return true;
    const ts = next?.toDate ? (next as { toDate: () => Date }).toDate().getTime() : new Date(next as string).getTime();
    return ts <= now;
  }).slice(0, BATCH_SIZE);

  let processed = 0;
  let failed = 0;

  for (const doc of docs) {
    const ok = await processJob(doc);
    if (ok) processed++;
    else failed++;
  }

  return { processed, failed };
}
