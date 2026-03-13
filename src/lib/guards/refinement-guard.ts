/**
 * 🔧 Refinement Guard: แก้ปัญหา "โด่งๆ แล้วระบบพัง"
 * 
 * Refinement = ข้อความสั้น ๆ ต่อจากบริการเดิม (ไม่ใช่ intent ใหม่)
 * เช่น "อยากทำแบบโด่งๆ", "แบบธรรมชาติ", "สายเกาหลี"
 * 
 * กติกา:
 * ❗ ไม่ใช่ intent ใหม่
 * ❗ ไม่ใช่ service ใหม่
 * ❗ แต่คือ REFINEMENT ของ service เดิม
 * 👉 ห้ามให้ AI คิดใหม่
 * 
 * หลักคิด:
 * Refinement = "ขยายความ"
 * ไม่ใช่ "ถามต่อ"
 */
export function isRefinementMessage(message: string): boolean {
  const trimmed = message.trim();
  
  // ถ้าข้อความยาวเกินไป → ไม่น่าจะเป็น refinement
  if (trimmed.length > 30) {
    return false;
  }

  const refinePatterns = [
    "โด่ง",
    "ธรรมชาติ",
    "เกาหลี",
    "ไม่เอาเวอร์",
    "ปลายพุ่ง",
    "พุ่ง",
    "สายฝอ",
    "แบบ",
    "ทรง",
    "สไตล์",
    "เล็ก",
    "ใหญ่",
    "เรียว",
    "แหลม",
    "มน",
    "หวาน",
    "คม",
    "ปลาย",
    "สาย",
    "กลัว",
    "กังวล",
    "เจ็บ"
  ];

  // ❌ ห้ามมีคำถาม / ห้ามมี intent อื่นปน
  const forbiddenPatterns = [
    "ราคา",
    "โปร",
    "ไหม",
    "?",
    "เท่าไหร่",
    "วันไหน",
    "ว่าง",
    "คิว",
    "จอง",
    "นัด",
    "ทำอะไร",
    "ต่างกัน",
    "ยังไง",
    "อย่างไร"
  ];

  const lower = trimmed.toLowerCase();
  
  // ถ้ามี forbidden pattern → ไม่ใช่ refinement
  if (forbiddenPatterns.some(pattern => lower.includes(pattern))) {
    return false;
  }

  // เช็คว่ามี refinement pattern หรือไม่
  return refinePatterns.some(pattern => lower.includes(pattern));
}
