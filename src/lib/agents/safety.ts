/**
 * Agent B — Policy & Medical Safety Guard
 * หน้าที่: กันความเสี่ยง / กฎหมาย / การแพทย์
 * Rule-based (ไม่ใช้ AI)
 */
import type { SafetyResult } from "./types";
import type { IntentType } from "./types";

/**
 * Rule-based Safety Check
 * ถ้า intent เป็น medical_question → ส่งต่อแพทย์
 * นอกนั้น → ตอบได้
 */
export function checkSafety(intent: IntentType): SafetyResult {
  if (intent === "medical_question") {
    return { allowed: false, action: "refer_to_doctor" };
  }
  return { allowed: true, action: "ai_can_answer" };
}
