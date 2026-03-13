/**
 * Phase 7 — Human Handoff Data Layer
 * organizations/{orgId}/handoff_sessions/{sessionId}
 * organizations/{orgId}/conversation_state/{lineUserId} — aiPaused
 */
import { db } from "@/lib/firebase-admin";
import type { HandoffSession, HandoffSessionCreate, HandoffStatus } from "@/types/handoff";

const HANDOFF_SUB = "handoff_sessions";
const CONV_STATE_SUB = "conversation_state";

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : new Date().toISOString();
}

/** Create handoff session */
export async function createHandoffSession(
  orgId: string,
  data: HandoffSessionCreate
): Promise<string> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const ref = db.collection("organizations").doc(orgId).collection(HANDOFF_SUB).doc();
  await ref.set({
    conversationId: data.conversationId,
    customerId: data.customerId,
    customerName: data.customerName,
    customerLineId: data.customerLineId,
    triggerType: data.triggerType,
    triggerMessage: data.triggerMessage,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });
  await setConversationAiPaused(orgId, data.customerLineId, true);
  return ref.id;
}

/** Set aiPaused for conversation (by line user) */
export async function setConversationAiPaused(
  orgId: string,
  lineUserId: string,
  paused: boolean
): Promise<void> {
  const safeId = lineUserId.replace(/[/\\]/g, "_");
  const ref = db.collection("organizations").doc(orgId).collection(CONV_STATE_SUB).doc(safeId);
  const { FieldValue } = await import("firebase-admin/firestore");
  await ref.set({ aiPaused: paused, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

/** Check if conversation is paused (AI should not respond) */
export async function isConversationAiPaused(
  orgId: string,
  lineUserId: string | null
): Promise<boolean> {
  if (!lineUserId) return false;
  const safeId = lineUserId.replace(/[/\\]/g, "_");
  const doc = await db
    .collection("organizations")
    .doc(orgId)
    .collection(CONV_STATE_SUB)
    .doc(safeId)
    .get();
  return doc.exists && doc.data()?.aiPaused === true;
}

/** Accept handoff — assign staff */
export async function acceptHandoffSession(
  orgId: string,
  sessionId: string,
  staffId: string,
  staffName: string
): Promise<boolean> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const ref = db.collection("organizations").doc(orgId).collection(HANDOFF_SUB).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.status !== "pending") return false;
  await ref.update({
    status: "accepted",
    assignedStaffId: staffId,
    assignedStaffName: staffName,
    acceptedAt: FieldValue.serverTimestamp(),
  });
  return true;
}

/** Resolve handoff — resume AI */
export async function resolveHandoffSession(
  orgId: string,
  sessionId: string,
  data: {
    resolutionNotes?: string;
    learningQuality?: "excellent" | "good" | "poor";
    markForLearning?: boolean;
  }
): Promise<boolean> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const ref = db.collection("organizations").doc(orgId).collection(HANDOFF_SUB).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists) return false;
  const d = doc.data()!;
  const lineUserId = d.customerLineId as string;
  await ref.update({
    status: "resolved",
    resolvedAt: FieldValue.serverTimestamp(),
    resolutionNotes: data.resolutionNotes ?? null,
    learningQuality: data.learningQuality ?? null,
    markForLearning: data.markForLearning ?? false,
  });
  await setConversationAiPaused(orgId, lineUserId, false);
  return true;
}

/** Get handoff session by ID */
export async function getHandoffSession(
  orgId: string,
  sessionId: string
): Promise<HandoffSession | null> {
  const doc = await db.collection("organizations").doc(orgId).collection(HANDOFF_SUB).doc(sessionId).get();
  if (!doc.exists) return null;
  return mapDocToHandoff({ id: doc.id, data: () => doc.data() ?? {}, exists: doc.exists });
}

/** List pending handoff sessions (for queue) */
export async function listPendingHandoffSessions(orgId: string): Promise<HandoffSession[]> {
  const snap = await db
    .collection("organizations")
    .doc(orgId)
    .collection(HANDOFF_SUB)
    .where("status", "==", "pending")
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map((d) => mapDocToHandoff({ id: d.id, data: () => d.data(), exists: true }));
}

/** List handoff history with filters */
export async function listHandoffHistory(
  orgId: string,
  opts: {
    from?: Date;
    to?: Date;
    status?: HandoffStatus;
    staffId?: string;
    triggerType?: string;
    limit?: number;
  }
): Promise<HandoffSession[]> {
  let q = db
    .collection("organizations")
    .doc(orgId)
    .collection(HANDOFF_SUB)
    .orderBy("createdAt", "desc")
    .limit(Math.min(opts.limit ?? 100, 500));

  if (opts.status) q = q.where("status", "==", opts.status) as typeof q;

  const snap = await q.get();
  let items = snap.docs.map((d) => mapDocToHandoff({ id: d.id, data: () => d.data(), exists: true }));

  if (opts.staffId) items = items.filter((h) => h.assignedStaffId === opts.staffId);
  if (opts.triggerType) items = items.filter((h) => h.triggerType === opts.triggerType);
  if (opts.from) items = items.filter((h) => new Date(h.createdAt) >= opts.from!);
  if (opts.to) items = items.filter((h) => new Date(h.createdAt) <= opts.to!);

  return items;
}

function mapDocToHandoff(doc: { id: string; data: () => Record<string, unknown>; exists: boolean }): HandoffSession {
  const d = doc.data();
  return {
    id: doc.id,
    conversationId: (d.conversationId as string) ?? "",
    customerId: (d.customerId as string) ?? "",
    customerName: (d.customerName as string) ?? "",
    customerLineId: (d.customerLineId as string) ?? "",
    triggerType: (d.triggerType as HandoffSession["triggerType"]) ?? "angry_customer",
    triggerMessage: (d.triggerMessage as string) ?? "",
    status: (d.status as HandoffStatus) ?? "pending",
    assignedStaffId: (d.assignedStaffId as string) ?? null,
    assignedStaffName: (d.assignedStaffName as string) ?? null,
    createdAt: toISO(d.createdAt),
    acceptedAt: d.acceptedAt ? toISO(d.acceptedAt) : null,
    resolvedAt: d.resolvedAt ? toISO(d.resolvedAt) : null,
    resolutionNotes: (d.resolutionNotes as string) ?? null,
    learningQuality: (d.learningQuality as HandoffSession["learningQuality"]) ?? null,
    markForLearning: (d.markForLearning as boolean) ?? false,
  };
}
