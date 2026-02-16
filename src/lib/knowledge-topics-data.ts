/**
 * Knowledge Topics + Versions — Enterprise Redesign
 * Org-scoped: organizations/{orgId}/knowledge_topics, knowledge_versions, knowledge_change_log
 * Multi-tenant safe: every query uses topicsRef(orgId)/versionsRef(orgId)/changeLogRef(orgId) — no cross-org scan.
 * Scale: 10,000 orgs × 200 topics = 2M docs; all reads filter by orgId first.
 */
import { db } from "@/lib/firebase-admin";
import { deleteKnowledgeVectorById } from "@/lib/knowledge-vector";
import type {
  KnowledgeTopic,
  KnowledgeTopicCategory,
  KnowledgeVersion,
  KnowledgeVersionPayload,
  KnowledgeVersionStatus,
  KnowledgeTopicListItem,
  KnowledgeChangeLogEntry,
  KnowledgeChangeAction,
  KnowledgeStaleStatus,
} from "@/types/knowledge";
import { KNOWLEDGE_DATA_CLASSIFICATION } from "@/types/knowledge";
import type { Timestamp } from "firebase-admin/firestore";

const MAX_TOPICS_PER_ORG = 200;
const STALE_DAYS_AGING = 90;
const STALE_DAYS_STALE = 120;

/** Stale status from updatedAt: computed at read time. */
function getStaleStatus(updatedAt: string): KnowledgeStaleStatus {
  const updatedMs = new Date(updatedAt).getTime();
  const now = Date.now();
  const days = (now - updatedMs) / (24 * 60 * 60 * 1000);
  if (days > STALE_DAYS_STALE) return "stale";
  if (days > STALE_DAYS_AGING) return "aging";
  return "fresh";
}

function toISO(t: Timestamp | Date | { toDate?: () => Date } | string): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = "toDate" in t && typeof t.toDate === "function" ? t.toDate() : (t as Timestamp).toDate?.();
  return d ? new Date(d).toISOString() : String(t);
}

function topicsRef(orgId: string) {
  return db.collection("organizations").doc(orgId).collection("knowledge_topics");
}

function versionsRef(orgId: string) {
  return db.collection("organizations").doc(orgId).collection("knowledge_versions");
}

function changeLogRef(orgId: string) {
  return db.collection("organizations").doc(orgId).collection("knowledge_change_log");
}

function toTopic(id: string, d: Record<string, unknown>): KnowledgeTopic {
  return {
    id,
    orgId: (d.orgId as string) ?? "",
    topic: (d.topic as string) ?? "",
    category: (d.category as KnowledgeTopicCategory) ?? "service",
    activeVersionId: (d.activeVersionId as string) ?? null,
    updatedAt: toISO(d.updatedAt as Timestamp),
    updatedBy: (d.updatedBy as string) ?? "",
  };
}

function toVersion(id: string, d: Record<string, unknown>): KnowledgeVersion {
  return {
    id,
    orgId: (d.orgId as string) ?? "",
    topicId: (d.topicId as string) ?? "",
    topic: (d.topic as string) ?? "",
    category: (d.category as KnowledgeTopicCategory) ?? "service",
    summary: Array.isArray(d.summary) ? d.summary : [],
    content: (d.content as string) ?? "",
    exampleQuestions: Array.isArray(d.exampleQuestions) ? d.exampleQuestions : [],
    createdBy: (d.createdBy as string) ?? "",
    createdAt: toISO(d.createdAt as Timestamp),
    status: (d.status as KnowledgeVersionStatus) ?? "draft",
    dataClassification: (d.dataClassification as string) ?? KNOWLEDGE_DATA_CLASSIFICATION,
  };
}

/** List topics for org with optional search. Capped at MAX_TOPICS_PER_ORG. */
export async function listKnowledgeTopics(
  orgId: string,
  opts?: { search?: string; limit?: number }
): Promise<KnowledgeTopicListItem[]> {
  const limit = Math.min(opts?.limit ?? 100, MAX_TOPICS_PER_ORG);
  let q = topicsRef(orgId).orderBy("updatedAt", "desc").limit(limit);

  const topicsSnap = await q.get();
  let topics = topicsSnap.docs.map((d) => toTopic(d.id, d.data()));

  if (opts?.search?.trim()) {
    const term = opts.search.trim().toLowerCase();
    topics = topics.filter((t) => t.topic.toLowerCase().includes(term));
  }

  const list: KnowledgeTopicListItem[] = [];
  for (const t of topics) {
    const activeVersion = t.activeVersionId
      ? await getKnowledgeVersion(orgId, t.activeVersionId)
      : null;
    const preview =
      activeVersion?.content?.slice(0, 120).replace(/\n/g, " ").trim() ||
      activeVersion?.summary?.[0] ||
      "";
    const status = activeVersion?.status ?? "draft";
    const staleStatus = getStaleStatus(t.updatedAt);
    list.push({
      id: t.id,
      topic: t.topic,
      category: t.category,
      preview: preview.slice(0, 120),
      lastUpdated: t.updatedAt,
      updatedBy: t.updatedBy || "—",
      status,
      activeVersionId: t.activeVersionId,
      staleStatus,
    });
  }
  return list;
}

/** Get single topic */
export async function getKnowledgeTopic(
  orgId: string,
  topicId: string
): Promise<KnowledgeTopic | null> {
  const doc = await topicsRef(orgId).doc(topicId).get();
  if (!doc.exists) return null;
  return toTopic(doc.id, doc.data()!);
}

/** Get single version */
export async function getKnowledgeVersion(
  orgId: string,
  versionId: string
): Promise<KnowledgeVersion | null> {
  const doc = await versionsRef(orgId).doc(versionId).get();
  if (!doc.exists) return null;
  return toVersion(doc.id, doc.data()!);
}

/** Get active version for a topic */
export async function getActiveKnowledgeVersion(
  orgId: string,
  topicId: string
): Promise<KnowledgeVersion | null> {
  const topic = await getKnowledgeTopic(orgId, topicId);
  if (!topic?.activeVersionId) return null;
  return getKnowledgeVersion(orgId, topic.activeVersionId);
}

/** List all versions for a topic (newest first). Sorted in memory to avoid composite index. */
export async function listKnowledgeVersions(
  orgId: string,
  topicId: string
): Promise<KnowledgeVersion[]> {
  const snap = await versionsRef(orgId)
    .where("topicId", "==", topicId)
    .get();
  const versions = snap.docs.map((d) => toVersion(d.id, d.data()));
  versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return versions;
}

/** Count topics for org (for limit enforcement) */
export async function countKnowledgeTopics(orgId: string): Promise<number> {
  const snap = await topicsRef(orgId).count().get();
  return snap.data().count;
}

/** Create topic and first version; version status = "updating". Returns { topicId, versionId }. */
export async function createKnowledgeTopicWithVersion(
  orgId: string,
  payload: KnowledgeVersionPayload,
  userId: string
): Promise<{ topicId: string; versionId: string }> {
  const count = await countKnowledgeTopics(orgId);
  if (count >= MAX_TOPICS_PER_ORG) {
    throw new Error(`คลินิกนี้มีข้อมูลครบ ${MAX_TOPICS_PER_ORG} รายการแล้ว ไม่สามารถเพิ่มได้`);
  }

  const { FieldValue } = await import("firebase-admin/firestore");
  const now = FieldValue.serverTimestamp();

  const versionRef = versionsRef(orgId).doc();
  const versionId = versionRef.id;
  await versionRef.set({
    orgId,
    topicId: "", // set after topic created
    topic: payload.topic.trim(),
    category: payload.category,
    summary: payload.summary ?? [],
    content: payload.content.trim().slice(0, 5000),
    exampleQuestions: payload.exampleQuestions ?? [],
    createdBy: userId,
    createdAt: now,
    status: "updating",
    dataClassification: KNOWLEDGE_DATA_CLASSIFICATION,
  });

  const topicRef = topicsRef(orgId).doc();
  const topicId = topicRef.id;
  await topicRef.set({
    orgId,
    topic: payload.topic.trim(),
    category: payload.category,
    activeVersionId: null,
    updatedAt: now,
    updatedBy: userId,
  });

  await versionRef.update({ topicId });

  await appendChangeLog(orgId, {
    topicId,
    topic: payload.topic.trim(),
    action: "created",
    userId,
  });

  return { topicId, versionId };
}

/** Create new version for existing topic; status = "updating". Returns versionId. */
export async function createKnowledgeVersion(
  orgId: string,
  topicId: string,
  payload: KnowledgeVersionPayload,
  userId: string
): Promise<string> {
  const topic = await getKnowledgeTopic(orgId, topicId);
  if (!topic) throw new Error("ไม่พบหัวข้อนี้");

  const { FieldValue } = await import("firebase-admin/firestore");
  const now = FieldValue.serverTimestamp();

  const versionRef = versionsRef(orgId).doc();
  const versionId = versionRef.id;
  await versionRef.set({
    orgId,
    topicId,
    topic: payload.topic.trim(),
    category: payload.category,
    summary: payload.summary ?? [],
    content: payload.content.trim().slice(0, 5000),
    exampleQuestions: payload.exampleQuestions ?? [],
    createdBy: userId,
    createdAt: now,
    status: "updating",
    dataClassification: KNOWLEDGE_DATA_CLASSIFICATION,
  });

  await topicsRef(orgId).doc(topicId).update({
    topic: payload.topic.trim(),
    category: payload.category,
    updatedAt: now,
    updatedBy: userId,
  });

  await appendChangeLog(orgId, {
    topicId,
    topic: payload.topic.trim(),
    action: "updated",
    userId,
  });

  return versionId;
}

/** Set version status (used by embedding worker). */
export async function setKnowledgeVersionStatus(
  orgId: string,
  versionId: string,
  status: KnowledgeVersionStatus
): Promise<void> {
  await versionsRef(orgId).doc(versionId).update({ status });
}

/** Mark version as active and previous active as archived. Call after successful embed. */
export async function setActiveVersionAndArchivePrevious(
  orgId: string,
  topicId: string,
  newActiveVersionId: string
): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const topic = await getKnowledgeTopic(orgId, topicId);
  if (!topic) return;

  if (topic.activeVersionId) {
    await versionsRef(orgId).doc(topic.activeVersionId).update({ status: "archived" });
  }
  await versionsRef(orgId).doc(newActiveVersionId).update({ status: "active" });
  await topicsRef(orgId).doc(topicId).update({
    activeVersionId: newActiveVersionId,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Mark version as failed (worker only). */
export async function markVersionFailed(orgId: string, versionId: string): Promise<void> {
  await versionsRef(orgId).doc(versionId).update({ status: "failed" });
}

/** Rollback: create new version from selected version content; status = "updating". Returns versionId. */
export async function rollbackToVersion(
  orgId: string,
  topicId: string,
  sourceVersionId: string,
  userId: string
): Promise<string> {
  const source = await getKnowledgeVersion(orgId, sourceVersionId);
  if (!source || source.topicId !== topicId) throw new Error("ไม่พบเวอร์ชันที่เลือก");

  const payload: KnowledgeVersionPayload = {
    topic: source.topic,
    category: source.category,
    summary: source.summary,
    content: source.content,
    exampleQuestions: source.exampleQuestions,
  };
  const versionId = await createKnowledgeVersion(orgId, topicId, payload, userId);
  await appendChangeLog(orgId, {
    topicId,
    topic: source.topic,
    action: "rolled_back",
    userId,
  });
  return versionId;
}

/** Delete topic and all its versions (hard delete). */
export async function deleteKnowledgeTopic(
  orgId: string,
  topicId: string,
  userId: string
): Promise<void> {
  const topic = await getKnowledgeTopic(orgId, topicId);
  if (!topic) throw new Error("ไม่พบหัวข้อนี้");

  const versionsSnap = await versionsRef(orgId).where("topicId", "==", topicId).get();
  const batch = db.batch();
  for (const d of versionsSnap.docs) {
    batch.delete(d.ref);
  }
  batch.delete(topicsRef(orgId).doc(topicId));
  await batch.commit();
  try {
    await deleteKnowledgeVectorById(orgId, topicId);
  } catch {
    // Best-effort: vector may already be missing
  }

  await appendChangeLog(orgId, {
    topicId,
    topic: topic.topic,
    action: "deleted",
    userId,
  });
}

/** Append change log entry */
export async function appendChangeLog(
  orgId: string,
  entry: { topicId: string; topic: string; action: KnowledgeChangeAction; userId: string }
): Promise<string> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const ref = await changeLogRef(orgId).add({
    orgId,
    topicId: entry.topicId,
    topic: entry.topic,
    action: entry.action,
    userId: entry.userId,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/** List change log entries (newest first). Fetches then sorts in memory to avoid index. */
export async function listKnowledgeChangeLog(
  orgId: string,
  opts?: { limit?: number }
): Promise<KnowledgeChangeLogEntry[]> {
  const limit = Math.min(opts?.limit ?? 50, 100);
  const snap = await changeLogRef(orgId).limit(limit + 50).get();
  const entries = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      orgId: (data.orgId as string) ?? "",
      topicId: (data.topicId as string) ?? "",
      topic: (data.topic as string) ?? "",
      action: (data.action as KnowledgeChangeAction) ?? "updated",
      userId: (data.userId as string) ?? "",
      createdAt: toISO(data.createdAt as Timestamp),
    };
  });
  entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return entries.slice(0, limit);
}
