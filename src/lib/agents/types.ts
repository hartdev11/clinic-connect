/**
 * Types for Intelligence Layer (Agents)
 * แยก "หน้าที่" ออกจาก "โมเดล" — เปลี่ยนโมเดลได้โดยไม่กระทบ logic
 */

/** Agent A — Intent & Context Analyzer output */

/** หมวดบริการหลัก (Service Category) */
export type ServiceCategory =
  | "filler"
  | "botox"
  | "rejuran"
  | "laser"
  | "skin"
  | "lifting"
  | "fat"
  | "hair"
  | "surgery"
  | "tattoo"
  | "consultation"
  | "other";

/** บริเวณที่ลูกค้าถามบ่อย (Area) */
export type Area =
  | "face"
  | "lip"
  | "chin"
  | "nose"
  | "jaw"
  | "cheek"
  | "under_eye"
  | "forehead"
  | "brow"
  | "eye"
  | "skin"
  | "body"
  | "hair"
  | "unknown";

/** Intent ที่ใช้จริงในคลินิก */
export type IntentType =
  | "greeting"
  | "promotion_inquiry"
  | "price_inquiry"
  | "service_information"
  | "comparison_inquiry" // 🔧 เพิ่ม: เปรียบเทียบบริการ (เช่น "ฟิลเลอร์กับโบท็อกซ์ต่างกันยังไง")
  | "hesitation" // 🔧 เพิ่ม: ความลังเล/กลัว (เช่น "กลัวพัง", "ยังไม่กล้าทำ")
  | "booking_request"
  | "availability_check"
  | "medical_question"
  | "aftercare_question"
  | "conversation_memory_check"
  | "complaint"
  | "general_chat"
  | "other";

/** ServiceType (backward compatibility) */
export type ServiceType = ServiceCategory | "chin_filler" | "unknown";

/**
 * 🧩 FIXED AREA SERVICE — บริการที่มี area ที่ fix แล้ว (ไม่ต้องถาม)
 * กติกา: ถ้า service อยู่ในกลุ่ม FIXED AREA → ❌ ห้ามถาม area → ❌ ห้ามโชว์ "ทำได้หลายบริเวณ"
 */
export const FIXED_AREA_SERVICES: Partial<Record<ServiceCategory | ServiceType, Area>> = {
  surgery: "nose", // "ทำจมูก" / "เสริมจมูก" = surgery + nose (FIXED)
  // เพิ่มได้ในอนาคต:
  // hair: "hair", // ปลูกผม = hair + hair (FIXED)
};

/**
 * เช็คว่า service นี้มี FIXED AREA หรือไม่
 */
export function hasFixedArea(service?: ServiceCategory | ServiceType): Area | undefined {
  if (!service) return undefined;
  return FIXED_AREA_SERVICES[service];
}

export interface IntentResult {
  intent: IntentType;
  service?: ServiceType | ServiceCategory;
  area?: Area;
  confidence: number;
}

/** Agent B — Policy & Medical Safety Guard output */
export interface SafetyResult {
  allowed: boolean;
  action: "ai_can_answer" | "refer_to_doctor";
}

/** Agent C — Business Knowledge Engine output */
export interface KnowledgeResult {
  service?: string;
  price?: string;
  promotion?: string;
  note?: string;
  opening_hours?: string;
  details?: string;
  /** E4 RAG: ข้อมูลจาก vector search (ใช้เสริม static) */
  ragContext?: string;
}

/** Agent D — Conversation Composer input (structured) */
export interface ComposeInput {
  intent: IntentType;
  service?: string;
  data: KnowledgeResult;
  tone?: string;
}

/** Agent E — Escalation & Human Handoff output (Phase 7) */
export interface EscalationResult {
  handoff: boolean;
  target?: "admin" | "doctor" | "support";
  /** Phase 7: trigger type for handoff_session */
  triggerType?: "angry_customer" | "explicit_request" | "loop_detected" | "medical";
}

/** Agent F — Memory / CRM / Analytics output */
export interface MemoryResult {
  interest?: string[];
  customer_stage?: string;
  sentiment?: string;
  follow_up_needed?: boolean;
}

/** Presentation Layer — format กลางหลัง normalize */
export interface NormalizedMessage {
  message: string;
  conversation_history?: { role: "user" | "assistant"; content: string }[];
}
