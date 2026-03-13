/**
 * Enterprise — Handoff Confidence Scoring (multi-signal)
 * Threshold: score >= 0.7 → trigger handoff
 */
import type { HandoffTriggerType } from "@/types/handoff";

export interface ConversationMessage {
  role?: "user" | "assistant";
  content: string;
}

const EXPLICIT_PATTERNS = [
  /ขอคุยพนักงาน/i,
  /คุยกับคน/i,
  /พนักงานมาคุย/i,
  /คุยกับคนจริง/i,
  /ส่งต่อ/i,
  /แอดมิน/i,
  /พูดกับคน/i,
  /ขอคน/i,
];

const ANGRY_KEYWORDS: Record<string, number> = {
  โกง: 0.3,
  หลอก: 0.3,
  ไม่พอใจ: 0.2,
  "จะฟ้อง": 0.25,
  ขอคืนเงิน: 0.2,
  แย่: 0.15,
};

const OBJECTION_PATTERNS = [
  /แพงไป/i,
  /ไม่สนใจ/i,
  /คิดดูก่อน/i,
  /ไม่เอา/i,
];

const MEDICAL_TRIGGER = /(แพ้|ตั้งครรภ์|โรค|กินยา).*(ได้ไหม|ปลอดภัย)|(ได้ไหม|ปลอดภัย).*(แพ้|ตั้งครรภ์|โรค|กินยา)/i;

const HANDOFF_THRESHOLD = 0.7;

export interface HandoffConfidenceResult {
  score: number;
  triggerType: HandoffTriggerType;
  reason: string;
}

/** Count consecutive objections in last N user messages */
function countObjections(messages: ConversationMessage[]): number {
  const userMessages = messages.filter((m) => (m.role ?? "user") === "user").map((m) => m.content);
  const last10 = userMessages.slice(-10);
  let count = 0;
  for (const msg of last10) {
    if (OBJECTION_PATTERNS.some((p) => p.test(msg))) count++;
  }
  return count;
}

/** Check complex medical question */
function isComplexMedical(message: string): boolean {
  return MEDICAL_TRIGGER.test(message);
}

export function calculateHandoffConfidence(
  message: string,
  history: ConversationMessage[]
): HandoffConfidenceResult {
  const msg = message.trim();
  const lowerMsg = msg.toLowerCase();

  // 1. Explicit request → instant 1.0
  if (EXPLICIT_PATTERNS.some((p) => p.test(msg))) {
    return {
      score: 1.0,
      triggerType: "explicit_request",
      reason: "explicit_request",
    };
  }

  let score = 0;
  const reasons: string[] = [];

  // 2. Angry keywords
  for (const [kw, val] of Object.entries(ANGRY_KEYWORDS)) {
    if (lowerMsg.includes(kw)) {
      score += val;
      reasons.push(`angry:${kw}`);
    }
  }

  // 3. Consecutive objections (last 10 messages)
  const objectionCount = countObjections(history);
  if (objectionCount >= 5) {
    score += 0.2;
    reasons.push("objections:5+");
  } else if (objectionCount >= 4) {
    score += 0.15;
    reasons.push("objections:4");
  } else if (objectionCount >= 3) {
    score += 0.1;
    reasons.push("objections:3");
  }

  // 4. Complex medical
  if (isComplexMedical(msg)) {
    score += 0.2;
    reasons.push("complex_medical");
  }

  score = Math.min(1, score);

  let triggerType: HandoffTriggerType = "angry_customer";
  if (reasons.includes("complex_medical") && score >= HANDOFF_THRESHOLD) {
    triggerType = "complex_medical";
  } else if (reasons.some((r) => r.startsWith("objections")) && score >= HANDOFF_THRESHOLD) {
    triggerType = "consecutive_objections";
  } else if (reasons.some((r) => r.startsWith("angry")) && score >= HANDOFF_THRESHOLD) {
    triggerType = "angry_customer";
  }

  const reason = reasons.length > 0 ? reasons.join(",") : "none";

  return {
    score,
    triggerType,
    reason,
  };
}

/** Check if confidence is high enough to trigger handoff */
export function shouldTriggerHandoff(result: HandoffConfidenceResult): boolean {
  return result.score >= HANDOFF_THRESHOLD;
}
