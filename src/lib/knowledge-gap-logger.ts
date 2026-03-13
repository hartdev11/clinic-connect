/**
 * Phase 14 — Knowledge Gap Logger
 * Log queries where RAG found no good results → organizations/{orgId}/metrics/{date}/knowledge_gaps
 */
import { db } from "@/lib/firebase-admin";
import { createHash } from "crypto";
import { getTodayKeyBangkok } from "@/lib/timezone";

function docIdForQuery(query: string): string {
  return createHash("md5").update(query.trim().toLowerCase(), "utf8").digest("hex").slice(0, 16);
}

/**
 * Log a knowledge gap (query that RAG could not answer well).
 * Uses merge to increment count for repeated queries.
 */
export async function logKnowledgeGap(orgId: string, query: string): Promise<void> {
  try {
    const today = getTodayKeyBangkok();
    const id = docIdForQuery(query);
    const ref = db
      .collection("organizations")
      .doc(orgId)
      .collection("metrics")
      .doc(today)
      .collection("knowledge_gaps")
      .doc(id);

    const { FieldValue } = await import("firebase-admin/firestore");
    await ref.set(
      {
        query: query.slice(0, 500),
        count: FieldValue.increment(1),
        lastSeen: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[logKnowledgeGap] error:", (err as Error)?.message?.slice(0, 80));
  }
}
