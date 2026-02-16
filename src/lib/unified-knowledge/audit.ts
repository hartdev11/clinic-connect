/**
 * Unified Knowledge — Audit Log (append-only, same audit_logs collection)
 */
import { db } from "@/lib/firebase-admin";

const COLLECTION = "audit_logs";

export type UnifiedKnowledgeAuditAction =
  | "unified_service_create"
  | "unified_service_update"
  | "unified_service_soft_delete"
  | "unified_faq_create"
  | "unified_faq_update"
  | "unified_faq_soft_delete"
  | "unified_faq_delete";

export async function logUnifiedKnowledgeAudit(params: {
  org_id: string;
  action: UnifiedKnowledgeAuditAction;
  user_id?: string | null;
  target_id?: string | null;
  target_type?: "clinic_service" | "clinic_faq";
  details?: Record<string, unknown>;
  /** Optional SHA256 of payload for integrity (future) */
  hash?: string | null;
}): Promise<void> {
  try {
    await db.collection(COLLECTION).add({
      org_id: params.org_id,
      action: params.action,
      user_id: params.user_id ?? null,
      target_id: params.target_id ?? null,
      target_type: params.target_type ?? null,
      details: params.details ?? {},
      ...(params.hash ? { hash: params.hash } : {}),
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn("[UnifiedKnowledge] Audit log failed:", (err as Error)?.message?.slice(0, 60));
  }
}
