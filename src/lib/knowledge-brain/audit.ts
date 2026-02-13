/**
 * Enterprise Knowledge Brain — Audit Log
 * ทุก action บันทึก audit_logs
 */
import { db } from "@/lib/firebase-admin";

const COLLECTION = "audit_logs";

export type KnowledgeAuditAction =
  | "knowledge_create"
  | "knowledge_update"
  | "knowledge_approve"
  | "knowledge_reject"
  | "knowledge_rollback"
  | "knowledge_reindex";

export async function logKnowledgeAudit(params: {
  org_id: string;
  action: KnowledgeAuditAction;
  user_id?: string | null;
  target_id?: string | null;
  target_type?: "clinic_knowledge" | "global_knowledge" | "version";
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.collection(COLLECTION).add({
      org_id: params.org_id,
      action: params.action,
      user_id: params.user_id ?? null,
      target_id: params.target_id ?? null,
      target_type: params.target_type ?? null,
      details: params.details ?? {},
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn("[KnowledgeBrain] Audit log failed:", (err as Error)?.message?.slice(0, 60));
  }
}
