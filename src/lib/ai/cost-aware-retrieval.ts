/**
 * Phase 3 #7 — Cost-Aware Retrieval Mode
 * Low complexity → skip vector, Known FAQ → cached deterministic, High risk → full retrieval
 */
import { getCachedResponse } from "./ai-feedback-loop";

const SIMPLE_PATTERNS = [
  /^(สวัสดี|hello|hi|หวัดดี|ดีครับ|ครับ)$/i,
  /^(เปิดกี่โมง|เวลาเปิด|business hours?)$/i,
];

const FAQ_PATTERNS = [
  /ที่อยู่|ที่ตั้ง|address|ไปยังไหน/i,
  /โทร|เบอร์|phone|contact/i,
];

export type RetrievalComplexity = "low" | "medium" | "high";

export function classifyRetrievalComplexity(message: string): RetrievalComplexity {
  const t = message.trim();
  if (SIMPLE_PATTERNS.some((p) => p.test(t))) return "low";
  if (FAQ_PATTERNS.some((p) => p.test(t)) && t.length < 30) return "medium";
  return "high";
}

export function shouldSkipVectorSearch(complexity: RetrievalComplexity): boolean {
  return complexity === "low";
}

export async function getDeterministicCachedReply(
  orgId: string,
  message: string
): Promise<string | null> {
  return getCachedResponse({ org_id: orgId, userMessage: message });
}
