/**
 * Security Audit Logging — บันทึกเหตุการณ์สำคัญลง Firestore collection: audit_logs
 * เหตุการณ์: login, logout, subscription change, plan upgrade/downgrade, manual override, failed auth
 */
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "audit_logs";

export type AuditEvent =
  | "login"
  | "logout"
  | "subscription_change"
  | "plan_upgrade"
  | "plan_downgrade"
  | "manual_override"
  | "manual_reply"
  | "failed_auth";

export interface AuditLogPayload {
  event: AuditEvent;
  org_id?: string;
  user_id?: string;
  email?: string;
  ip?: string;
  user_agent?: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}

/** Fire-and-forget: ไม่ block main flow */
export async function writeAuditLog(payload: AuditLogPayload): Promise<void> {
  try {
    await db.collection(COLLECTION).add({
      ...payload,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch {
    // Non-blocking — ละทิ้งถ้า Firestore ล้มเหลว
  }
}
