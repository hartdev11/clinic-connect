import type { ConversationState } from "../agents/conversation-state";

/**
 * Preference Response Guard
 * 
 * 🔑 ป้องกันการถามซ้ำเมื่อลูกค้าตอบ preference
 * 
 * ปัญหา:
 * เมื่อลูกค้าตอบ preference (เช่น "ธรรมชาติ") ระบบอาจ treat เป็น general_chat
 * แล้วถามคำถามกว้าง ๆ แทนที่จะ acknowledge + ถามต่อ
 * 
 * แนวคิด:
 * ถ้า user เพิ่งตอบ preference
 * ❌ ห้ามถาม "สนใจอะไรเพิ่ม"
 * ❌ ห้าม fallback
 * ✅ ต้อง acknowledge + ต่อ flow เดิม
 * 
 * @param state State ปัจจุบัน
 * @param message ข้อความจากลูกค้า
 * @returns true ถ้าเป็น preference response (ต้อง acknowledge), false ถ้าไม่ใช่
 */
export function isPreferenceResponse(
  state: ConversationState,
  message: string
): boolean {
  // ถ้าไม่มี service + area → ไม่ใช่ preference response
  if (!state.service || !state.area) {
    return false;
  }

  // สำหรับศัลยกรรมจมูก: ถ้าถาม style แล้ว แต่ยังไม่มี preference.style
  // และข้อความใหม่เป็น style response
  if (
    state.service === "surgery" &&
    state.area === "nose" &&
    !state.preference?.style
  ) {
    const lower = message.toLowerCase().trim();
    
    // Detect style response
    const styleKeywords = [
      "ธรรมชาติ",
      "เกาหลี",
      "สายเกาหลี",
      "โด่ง",
      "ปลายพุ่ง",
      "พุ่ง",
      "สายฝอ",
      "คม",
      "หวาน",
      "ละมุน"
    ];
    
    // ถ้าข้อความสั้น (ไม่เกิน 10 ตัวอักษร) และมี style keyword
    if (message.length <= 10 && styleKeywords.some(keyword => lower.includes(keyword))) {
      return true; // เป็น preference response
    }
  }

  // สำหรับศัลยกรรมจมูก: ถ้ามี style แล้ว แต่ยังไม่มี intensity
  // และข้อความใหม่เป็น intensity response
  if (
    state.service === "surgery" &&
    state.area === "nose" &&
    state.preference?.style &&
    !state.preference?.intensity
  ) {
    const lower = message.toLowerCase().trim();
    
    // Detect intensity response
    const intensityKeywords = [
      "เบา",
      "เบา ๆ",
      "ไม่เวอร์",
      "ไม่เอาเวอร์",
      "ชัด",
      "ชัดเจน",
      "เด่น",
      "กลาง",
      "พอดี",
      "ละมุน"
    ];
    
    // ถ้าข้อความสั้น (ไม่เกิน 10 ตัวอักษร) และมี intensity keyword
    if (message.length <= 10 && intensityKeywords.some(keyword => lower.includes(keyword))) {
      return true; // เป็น preference response
    }
  }

  return false; // ไม่ใช่ preference response
}
