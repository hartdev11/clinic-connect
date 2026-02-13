import type { ConversationState } from "../agents/conversation-state";
import type { IntentResult } from "../agents/types";

/**
 * State Stickiness Guard
 * 
 * 🔑 ป้องกัน state หาย/reset เมื่อพิมพ์สั้น ๆ ซ้ำความหมายเดิม
 * 
 * หลักคิดสำคัญ:
 * ถ้า ข้อความใหม่ไม่ได้เพิ่มข้อมูลใหม่
 * → ❌ ห้าม reset state
 * → ❌ ห้ามถามคำถามใหม่
 * → แค่ "รอ" หรือ "พยักหน้า"
 * 
 * ตัวอย่าง:
 * - "สนใจทำจมูก" → service = surgery, area = nose
 * - "อยากทำจมูก" → ถ้า service + area เหมือนเดิม → ห้าม reset
 * - "ทำจมูกครับ" → ถ้า service + area เหมือนเดิม → ห้าม reset
 * 
 * @param prevState State ก่อนหน้า
 * @param intentResult Intent result จากข้อความใหม่
 * @returns true ถ้า state ไม่ควรเปลี่ยน (stick), false ถ้าเปลี่ยนได้
 */
export function stateStickinessGuard(
  prevState: ConversationState,
  intentResult: IntentResult
): boolean {
  // ถ้าไม่มี state ก่อนหน้า → ไม่ stick (เปลี่ยนได้)
  if (!prevState.service || !prevState.area) {
    return false;
  }

  // 🔥 State Stickiness สำหรับศัลยกรรม (สำคัญมาก)
  // ถ้า state.service === surgery และ state.area === nose
  // และยังอยู่ใน session เดิม
  // ❌ ห้ามกลับไปถาม "สนใจศัลยกรรมอะไร"
  if (
    prevState.service === "surgery" &&
    prevState.area === "nose" &&
    prevState.service === intentResult.service &&
    prevState.area === intentResult.area
  ) {
    // ถ้า intent เดิม หรือ intent ไม่ได้เพิ่มข้อมูลใหม่ → stick
    if (
      prevState.intent === intentResult.intent ||
      intentResult.intent === "general_chat" ||
      intentResult.intent === "promotion_inquiry"
    ) {
      return true; // Stick - ห้าม reset state, ห้ามถามซ้ำ
    }
  }

  // ถ้า service + area เหมือนเดิม (สำหรับทุก service)
  if (
    prevState.service === intentResult.service &&
    prevState.area === intentResult.area
  ) {
    // intent เดิม หรือ intent ไม่ได้เพิ่มข้อมูลใหม่
    // เช่น promotion_inquiry → promotion_inquiry (ซ้ำ)
    // หรือ general_chat → promotion_inquiry (แต่ service/area เหมือนเดิม)
    if (
      prevState.intent === intentResult.intent ||
      intentResult.intent === "general_chat" ||
      intentResult.intent === "promotion_inquiry"
    ) {
      return true; // Stick - ห้าม reset state
    }
  }

  return false; // ไม่ stick - ดำเนิน flow ปกติ
}
