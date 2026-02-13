/**
 * Presentation Layer — Message Normalizer
 * แปลงข้อความจากช่องทาง (LINE / WhatsApp / Web) เป็น format กลาง
 * ชั้นนี้ไม่รู้จัก AI / โมเดล
 */
import type { NormalizedMessage } from "./types";

/**
 * แปลงข้อความจาก LINE event เป็น format กลาง
 * ตอนนี้ยังไม่มี conversation_history (ต่อมาเชื่อม session/DB ได้)
 */
export function normalizeLineMessage(userText: string): NormalizedMessage {
  return {
    message: userText?.trim() ?? "",
    conversation_history: [], // TODO: ดึงจาก session / DB เมื่อมี
  };
}
