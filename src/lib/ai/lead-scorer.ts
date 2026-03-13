/**
 * Phase 13 — Full 5-Signal Lead Scorer
 * Phase 22: + P4 intent templates as Signal 0 (weight 30%)
 * calculateScore(message, history) → 0-1
 * Priority: very_hot(≥0.8) | hot(≥0.6) | warm(≥0.3) | cold(<0.3)
 */
export type LeadPriority = "very_hot" | "hot" | "warm" | "cold";

export interface LeadScorerHistory {
  userMessage: string;
  createdAt?: string;
}

/** Phase 22: P4 intent templates — Signal 0 (weight 30%) */
const P4_INTENT_PATTERNS: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /จอง|มัดจำ|โอน|นัด|ว่างเมื่อ|จองคิว/i, score: 0.9 }, // Deposit Booking
  { pattern: /โปร|ทันไหม|สิทธิ์|limited|หมดเมื่อ/i, score: 0.7 },   // Limited Time Offer
  { pattern: /แต่งงาน|เที่ยว|อาทิตย์หน้า|เดือนหน้า|วันเกิด/i, score: 0.6 }, // Special Occasion
  { pattern: /แพคเกจ|เหมา|ทำหลาย|combo|เซ็ต/i, score: 0.2 },        // Bundle Seeking
  { pattern: /ราคา|เท่าไหร่|กี่บาท|1cc|cc เท่าไหร่/i, score: 0.15 }, // Direct Price Check
];

function scoreP4Intent(message: string): number {
  const lower = message.trim().toLowerCase();
  if (lower.length < 2) return 0;
  for (const { pattern, score } of P4_INTENT_PATTERNS) {
    if (pattern.test(message)) return score;
  }
  return 0;
}

// Signal 1 — Intent (weight 40%, reduced when P4 contributes)
const INTENT_PATTERNS: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /จองนัด|อยากจอง|พรุ่งนี้ว่าง|มีคิวไหม|จองได้ไหม|จองให้ที|ต้องการนัด|นัดหน่อย|จองวันนี้|จองพรุ่งนี้|ว่างเมื่อไหร่|จองคิว/i, score: 0.9 },
  { pattern: /ราคา|เท่าไหร่|แพงไหม|โปรโมชั่น|โปร|มีโปร|ราคาเท่าไหร่|คิดเงินยังไง|ค่าใช้จ่าย/i, score: 0.5 },
  { pattern: /ต่างกัน|เลือก|ดีกว่า|เปรียบเทียบ|อันไหนดี|vs|เทียบกัน/i, score: 0.3 },
  { pattern: /คืออะไร|แนะนำ|สงสัย|ทำอะไรได้|แบบไหน|อย่างไร|ยังไง|ช่วยแนะนำ|อยากรู้/i, score: 0.2 },
  { pattern: /แพงไป|ไม่สนใจ|คิดดูก่อน|ยังไม่แน่ใจ|กลัว|ลังเล|ไม่กล้า|กังวล|ไว้ก่อน/i, score: 0.1 },
];

function scoreIntent(message: string): number {
  const lower = message.trim().toLowerCase();
  if (lower.length < 2) return 0;
  for (const { pattern, score } of INTENT_PATTERNS) {
    if (pattern.test(lower)) return score;
  }
  return 0; // chitchat
}

// Signal 2 — Engagement (weight 20%)
function scoreEngagement(message: string, recentCustomerMsgCount: number): number {
  let s = 0;
  const len = message.length;
  if (len > 100) s += 0.1;
  else if (len > 50) s += 0.05;
  if (/\?|ไหม|อย่างไร|ยังไง|แบบไหน|ทำยังไง/.test(message)) s += 0.05;
  if (recentCustomerMsgCount >= 3) s += 0.05;
  return Math.min(0.2, s);
}

// Signal 3 — Pain Points (weight 20%)
const PAIN_KEYWORDS = /ฝ้า|กระ|สิว|รอยดำ|หมองคล้ำ|แก่|หย่อนคล้อย|อ้วน|รอยแผล|จุดด่างดำ/;

function scorePainPoints(message: string): number {
  const matches = message.match(new RegExp(PAIN_KEYWORDS.source, "gi"));
  if (!matches) return 0;
  const count = matches.length;
  return Math.min(0.2, count * 0.07);
}

// Signal 4 — Objections (weight 10%)
const OBJECTION_WORDS = /แพงไป|ไม่สนใจ|คิดดูก่อน|ไม่แน่ใจ|กลัว|ลังเล|ไม่กล้า|กังวล|ไว้ก่อน|ไม่ต้องการ|ไม่จำเป็น/;

function scoreObjections(message: string, historyMessages: string[]): number {
  const msgHasObjection = OBJECTION_WORDS.test(message);
  const historyObjections = historyMessages.filter((m) => OBJECTION_WORDS.test(m)).length;
  if (msgHasObjection || historyObjections >= 2) return 0;
  return 0.1;
}

// Signal 5 — Timeline (weight 10%)
const TIMELINE_PATTERNS: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /วันนี้|ตอนนี้|เดี๋ยวนี้|วันนี้ได้ไหม/i, score: 0.1 },
  { pattern: /พรุ่งนี้|วันพรุ่ง/i, score: 0.08 },
  { pattern: /อาทิตย์นี้|สัปดาห์นี้|สัปดาห์หน้า|สัปดาห์ถัดไป/i, score: 0.06 },
  { pattern: /สัปดาห์หน้า|อาทิตย์หน้า/i, score: 0.04 },
  { pattern: /เดือนหน้า|เดื่อนถัดไป/i, score: 0.02 },
];

function scoreTimeline(message: string): number {
  for (const { pattern, score } of TIMELINE_PATTERNS) {
    if (pattern.test(message)) return score;
  }
  return 0;
}

export interface LeadScorerResult {
  score: number;
  priority: LeadPriority;
}

/**
 * calculateScore(message, history) → 0-1
 */
export function calculateScore(
  message: string,
  history: LeadScorerHistory[] = []
): LeadScorerResult {
  const recentCustomerMessages = history
    .filter((h) => h.userMessage?.trim())
    .slice(-5)
    .map((h) => h.userMessage);
  const recentCount = recentCustomerMessages.length;

  const intentRaw = scoreIntent(message);
  const s1 = (intentRaw / 0.9) * 0.4;
  const s2 = scoreEngagement(message, recentCount);
  const s3 = scorePainPoints(message);
  const s4 = scoreObjections(message, recentCustomerMessages);
  const s5 = scoreTimeline(message);
  const p4Intent = scoreP4Intent(message);

  const raw5 = s1 + s2 + s3 + s4 + s5;
  const score = Math.min(
    1,
    Math.max(0, Math.round((raw5 * 0.7 + p4Intent * 0.3) * 100) / 100)
  );

  const effectiveScore = score;
  let priority: LeadPriority;
  if (effectiveScore >= 0.8) priority = "very_hot";
  else if (effectiveScore >= 0.6) priority = "hot";
  else if (effectiveScore >= 0.3) priority = "warm";
  else priority = "cold";

  return { score: effectiveScore, priority };
}

export function getPriorityFromScore(score: number): LeadPriority {
  if (score >= 0.8) return "very_hot";
  if (score >= 0.6) return "hot";
  if (score >= 0.3) return "warm";
  return "cold";
}
