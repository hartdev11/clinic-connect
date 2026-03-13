/**
 * Phase 13 — Dynamic Sales Mode
 * getSalesInstructions(leadScore) → string injected into AI system prompt
 */
import type { LeadPriority } from "./lead-scorer";

export function getSalesInstructions(priority: LeadPriority): string {
  switch (priority) {
    case "very_hot":
      return "ลูกค้าพร้อมจองมาก! ปิดการขายเลย: เสนอนัดหมายทันที ถามวันที่สะดวก ขอเบอร์โทร";
    case "hot":
      return "ลูกค้าสนใจมาก! กระตุ้น: เน้นประโยชน์ สร้างความเร่งด่วน ลดอุปสรรค";
    case "warm":
      return "ลูกค้าสนใจปานกลาง: ตอบละเอียด แชร์รีวิว เสนอปรึกษาฟรี";
    case "cold":
      return "ลูกค้าแค่ดูข้อมูล: ให้ความรู้ ไม่กดดัน ให้เวลาคิด";
    default:
      return "ลูกค้าแค่ดูข้อมูล: ให้ความรู้ ไม่กดดัน ให้เวลาคิด";
  }
}

export function getSalesInstructionsFromScore(score: number): string {
  let priority: LeadPriority;
  if (score >= 0.8) priority = "very_hot";
  else if (score >= 0.6) priority = "hot";
  else if (score >= 0.3) priority = "warm";
  else priority = "cold";
  return getSalesInstructions(priority);
}
