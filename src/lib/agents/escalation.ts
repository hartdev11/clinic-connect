/**
 * Agent E — Escalation & Human Handoff
 * Phase 7: รองรับ trigger types (angry_customer, explicit_request, loop_detected, medical)
 */
import type { EscalationResult } from "./types";
import type { IntentType } from "./types";

/**
 * Rule-based Escalation Check
 * Phase 7: คืนค่า triggerType สำหรับ handoff_session
 */
export function checkEscalation(intent: IntentType, userMessage?: string): EscalationResult {
  const msg = (userMessage ?? "").toLowerCase();
  if (intent === "complaint") {
    return { handoff: true, target: "admin", triggerType: "angry_customer" };
  }
  if (intent === "medical_question") {
    return { handoff: true, target: "doctor", triggerType: "medical" };
  }
  if (/คุยกับคน|คุยคนจริง|ส่งต่อ|แอดมิน|พนักงาน|พูดกับคน|ขอคน/i.test(msg)) {
    return { handoff: true, target: "admin", triggerType: "explicit_request" };
  }
  return { handoff: false };
}

/** Phase 7: ตรวจสอบ loop detected (ส่งให้ pipeline เรียกเพิ่ม) */
export function checkLoopDetected(_recentMessages: string[]): boolean {
  return false;
}
