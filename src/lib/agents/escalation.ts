/**
 * Agent E — Escalation & Human Handoff
 * หน้าที่: ตัดสินใจส่งต่อคนจริง (admin / doctor / support)
 * Rule-based (ไม่ใช้ AI)
 */
import type { EscalationResult } from "./types";
import type { IntentType } from "./types";

/**
 * Rule-based Escalation Check
 * ส่งต่อเฉพาะกรณี complaint หรือ medical_question (ถ้ายังไม่ถูก B จัดการ)
 */
export function checkEscalation(intent: IntentType): EscalationResult {
  if (intent === "complaint") {
    return { handoff: true, target: "admin" };
  }
  // medical_question ถูกจัดการโดย Agent B แล้ว
  return { handoff: false };
}
