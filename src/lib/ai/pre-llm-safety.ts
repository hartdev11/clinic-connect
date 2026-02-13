/**
 * Pre-LLM Safety Layer — Enterprise
 * Content classification ก่อนเข้า LLM
 * Block / Escalate logic — อย่าให้ LLM เป็น safety layer
 */
import type { PreLLMSafetyResult, SafetyClassification } from "@/types/ai-enterprise";

const MEDICAL_PATTERNS = [
  /วินิจฉัย|diagnos|รักษาได้ไหม|เป็นอะไร|โรค|อาการ|แพ้|ผลข้างเคียง|ปลอดภัยไหม|รับประกันผล|ผลลัพธ์แน่นอน/i,
];

const LEGAL_PATTERNS = [
  /ถูกกฎหมาย|ผิดกฎหมาย|กฎหมาย|กฎ|ข้อกฎหมาย|ฟ้อง|คดี|attorney|legal/i,
];

const FINANCIAL_SENSITIVE_PATTERNS = [
  /รายได้|ยอดขาย|revenue|กำไร|ขาดทุน|ข้อมูลการเงิน|financial.*internal/i,
];

const ABUSIVE_PATTERNS = [
  /\bfucking\b|\bshit\b|แม่ง|ไอ้สัตว์|stupid|idiot|\bdumb\b/i,
  /[\u0E00-\u0E7F]{50,}/, // Thai spam
];

/** Classification rule-based — เร็ว ไม่ต้องเรียก LLM */
export function classifyPreLLM(userMessage: string): PreLLMSafetyResult {
  const trimmed = userMessage.trim();
  if (trimmed.length < 2) {
    return { classification: "safe", block: false, escalate: false };
  }

  for (const p of ABUSIVE_PATTERNS) {
    if (p.test(trimmed)) {
      return {
        classification: "abusive",
        block: true,
        escalate: true,
        suggested_action: "block",
        reason: "Abusive content detected",
      };
    }
  }

  for (const p of MEDICAL_PATTERNS) {
    if (p.test(trimmed)) {
      return {
        classification: "medical_intent",
        block: false,
        escalate: true,
        suggested_action: "escalate",
        reason: "Medical intent — refer to doctor",
      };
    }
  }

  for (const p of LEGAL_PATTERNS) {
    if (p.test(trimmed)) {
      return {
        classification: "legal_intent",
        block: false,
        escalate: true,
        suggested_action: "escalate",
        reason: "Legal intent — do not advise",
      };
    }
  }

  for (const p of FINANCIAL_SENSITIVE_PATTERNS) {
    if (p.test(trimmed)) {
      return {
        classification: "financial_sensitive",
        block: true,
        escalate: false,
        suggested_action: "block",
        reason: "Financial internal data request",
      };
    }
  }

  return { classification: "safe", block: false, escalate: false };
}

/** คำตอบ default เมื่อ block/escalate — โทนมนุษย์ ไม่ template */
export const SAFETY_FALLBACK_MESSAGES: Record<SafetyClassification, string> = {
  safe: "",
  medical_intent:
    "เรื่องนี้ให้หมอที่คลินิกดูจะเหมาะสมกว่าค่ะ โทรนัดหรือแวะมาได้เลยนะคะ",
  legal_intent:
    "เรื่องนี้แนะนำให้ปรึกษาผู้เชี่ยวชาญโดยตรงค่ะ",
  financial_sensitive:
    "ข้อมูลส่วนนี้เป็นข้อมูลภายใน ไม่เปิดเผยได้ค่ะ",
  abusive:
    "มีคำถามหรืออยากให้ช่วยอะไร แอดมินตอบให้ได้นะคะ",
  block: "ช่วยตอบเรื่องนี้ไม่ได้ตอนนี้ค่ะ โทรมาคลินิกได้เลยนะคะ",
};
