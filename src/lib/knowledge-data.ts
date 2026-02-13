/**
 * E5.7–E5.9 — Knowledge Documents Data Layer
 * Firestore CRUD สำหรับ knowledge_documents
 */
import { db } from "@/lib/firebase-admin";
import type { KnowledgeDocument, KnowledgeDocumentCreate } from "@/types/knowledge";
import type { Timestamp } from "firebase-admin/firestore";

const COLLECTION = "knowledge_documents";

function toISO(t: Timestamp | Date | { toDate?: () => Date } | string): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = "toDate" in t && typeof t.toDate === "function" ? t.toDate() : (t as Timestamp).toDate?.();
  return d ? new Date(d).toISOString() : String(t);
}

function toDoc(docId: string, d: Record<string, unknown>): KnowledgeDocument {
  return {
    id: docId,
    level: (d.level as KnowledgeDocument["level"]) ?? "global",
    org_id: (d.org_id as string) ?? null,
    branch_id: (d.branch_id as string) ?? null,
    topic: (d.topic as string) ?? "",
    category: (d.category as string) ?? "",
    key_points: Array.isArray(d.key_points) ? d.key_points : JSON.parse(String(d.key_points ?? "[]")),
    text: (d.text as string) ?? "",
    expires_at: (d.expires_at as string) ?? null,
    is_active: Boolean(d.is_active),
    archived_at: (d.archived_at as string) ?? null,
    source: (d.source as string) ?? "manual",
    createdAt: toISO(d.createdAt as Timestamp),
    updatedAt: toISO(d.updatedAt as Timestamp),
  };
}

/** ค้นหา exact match ตาม text (trim, collapse whitespace) */
export async function findKnowledgeByExactText(
  text: string,
  opts?: { org_id?: string | null; branch_id?: string | null }
): Promise<KnowledgeDocument | null> {
  const normalized = text.trim().replace(/\s+/g, " ");
  let q = db.collection(COLLECTION).where("text", "==", normalized).limit(1);
  if (opts?.org_id) q = q.where("org_id", "==", opts.org_id) as typeof q;
  if (opts?.branch_id) q = q.where("branch_id", "==", opts.branch_id) as typeof q;
  const snapshot = await q.get();
  if (snapshot.empty) return null;
  return toDoc(snapshot.docs[0].id, snapshot.docs[0].data());
}

/** AI Analytics — list knowledge docs สำหรับ org (global + org-specific) */
export async function listKnowledgeDocsForOrg(
  orgId: string,
  opts?: { branchId?: string | null; limit?: number }
): Promise<KnowledgeDocument[]> {
  const limit = Math.min(opts?.limit ?? 30, 50);

  // Query 1: org-specific
  const q1 = db
    .collection(COLLECTION)
    .where("org_id", "==", orgId)
    .where("is_active", "==", true)
    .limit(limit);
  const snap1 = await q1.get();
  const docs: KnowledgeDocument[] = snap1.docs.map((d) => toDoc(d.id, d.data()));

  // Query 2: global (org_id null)
  if (docs.length < limit) {
    const q2 = db
      .collection(COLLECTION)
      .where("org_id", "==", null)
      .where("is_active", "==", true)
      .limit(limit - docs.length);
    const snap2 = await q2.get();
    for (const d of snap2.docs) {
      docs.push(toDoc(d.id, d.data()));
    }
  }

  return docs;
}

/** ดึง doc ตาม id */
export async function getKnowledgeDocById(id: string): Promise<KnowledgeDocument | null> {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return toDoc(doc.id, doc.data()!);
}

/** สร้าง knowledge document */
export async function createKnowledgeDoc(
  data: KnowledgeDocumentCreate
): Promise<string> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const now = FieldValue.serverTimestamp();
  const doc = await db.collection(COLLECTION).add({
    level: data.level,
    org_id: data.org_id ?? null,
    branch_id: data.branch_id ?? null,
    topic: data.topic,
    category: data.category,
    key_points: data.key_points,
    text: data.text.trim().replace(/\s+/g, " "),
    expires_at: data.expires_at ?? null,
    is_active: data.is_active,
    archived_at: data.archived_at ?? null,
    source: data.source,
    createdAt: now,
    updatedAt: now,
  });
  return doc.id;
}

/** อัปเดต knowledge document */
export async function updateKnowledgeDoc(
  id: string,
  data: Partial<KnowledgeDocumentCreate>
): Promise<boolean> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const docRef = db.collection(COLLECTION).doc(id);
  const doc = await docRef.get();
  if (!doc.exists) return false;

  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (data.level !== undefined) update.level = data.level;
  if (data.org_id !== undefined) update.org_id = data.org_id ?? null;
  if (data.branch_id !== undefined) update.branch_id = data.branch_id ?? null;
  if (data.topic !== undefined) update.topic = data.topic;
  if (data.category !== undefined) update.category = data.category;
  if (data.key_points !== undefined) update.key_points = data.key_points;
  if (data.text !== undefined) update.text = data.text.trim().replace(/\s+/g, " ");
  if (data.expires_at !== undefined) update.expires_at = data.expires_at ?? null;
  if (data.is_active !== undefined) update.is_active = data.is_active;
  if (data.archived_at !== undefined) update.archived_at = data.archived_at ?? null;
  if (data.source !== undefined) update.source = data.source;

  await docRef.update(update);
  return true;
}
