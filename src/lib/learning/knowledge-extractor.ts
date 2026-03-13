/**
 * Phase 16 — Knowledge Extractor
 * Phase 24 — Gemini-based quality evaluation
 * Extract Q&A pairs and pricing from handoff conversation
 */
import { listConversationFeedbackByUserId } from "@/lib/clinic-data";
import { getHandoffSession } from "@/lib/handoff-data";
import { getGemini } from "@/lib/agents/clients";

const MEDICAL_TERMS =
  /โบท็อกซ์|ฟิลเลอร์|เลเซอร์|HIFU|ราคา|ฉีด|ทำ|ผลข้างเคียง/i;

export interface KnowledgeItem {
  type: "qa" | "pricing";
  question?: string;
  answer?: string;
  service?: string;
  price?: string;
  details?: string;
  confidence: number;
  rawQuestion?: string;
  rawAnswer?: string;
}

const QUESTION_INDICATORS = /[?]|ไหม|อย่างไร|ยังไง|เท่าไหร่|คือ|แนะนำ|ควร/;

const PRICING_REGEX = /([ก-๙A-Za-z0-9\s]+?)\s+([0-9,]+)\s*บาท/g;

/** Compute confidence for Q&A item */
function qaConfidence(question: string, answer: string): number {
  let c = 0.5;
  if (answer.length > 20) c += 0.1;
  if (answer.length > 50) c += 0.1;
  if (/\d|บาท|฿|ครั้ง|รอบ/.test(answer)) c += 0.1;
  if (answer.length < 200) c += 0.1;
  if (/ค่ะ|ครับ|นะคะ|นะครับ/.test(answer)) c += 0.1;
  return Math.min(1, c);
}

export type QualityDecision = "auto_approve" | "queue" | "reject";

export interface QualityEvaluationResult {
  score: number;
  decision: QualityDecision;
  reason: string;
}

/**
 * Phase 24 — Gemini-based quality evaluation for Q&A pairs
 * score = 0.2 (question length) + 0.2 (answer length) + 0.2 (medical terms) + 0.4 (Gemini)
 */
export async function evaluateQuality(
  question: string,
  answer: string
): Promise<QualityEvaluationResult> {
  let score = 0;

  if (question.length >= 20 && question.length <= 200) score += 0.2;
  if (answer.length >= 40 && answer.length <= 500) score += 0.2;
  if (MEDICAL_TERMS.test(question) || MEDICAL_TERMS.test(answer)) score += 0.2;

  const gemini = getGemini();
  if (gemini) {
    const prompt = `ประเมินคุณภาพ Q&A (0-10):
คำถาม: ${question}
คำตอบ: ${answer}
เกณฑ์: ภาษาธรรมชาติ, ข้อมูลถูกต้อง, ตอบตรง, ไม่โอ้อวด
ตอบเฉพาะตัวเลข 0-10:`;
    try {
      const response = await gemini.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
        config: {
          temperature: 0.1,
          maxOutputTokens: 10,
        },
      });
      const text = (response?.text ?? "").trim();
      const num = parseInt(text.replace(/\D/g, ""), 10);
      const geminiScore = Number.isNaN(num) ? 5 : Math.max(0, Math.min(10, num));
      score += (geminiScore / 10) * 0.4;
    } catch {
      score += 0.2;
    }
  } else {
    score += 0.2;
  }

  const rounded = Math.round(score * 100) / 100;
  const { getPlatformConfig } = await import("./platform-config");
  const config = await getPlatformConfig();
  const minAuto = config.minQualityScoreForAutoApprove;
  const minQueue = config.minQualityScoreForQueue;
  if (rounded >= minAuto) {
    return { score: rounded, decision: "auto_approve", reason: `quality >= ${minAuto}` };
  }
  if (rounded >= minQueue) {
    return { score: rounded, decision: "queue", reason: `${minQueue} ≤ quality < ${minAuto}` };
  }
  return { score: rounded, decision: "reject", reason: `quality < ${minQueue}` };
}

/** Extract Q&A pairs: customer question → staff answer (consecutive) */
export async function extractFromHandoff(
  handoffId: string,
  orgId: string
): Promise<KnowledgeItem[]> {
  const handoff = await getHandoffSession(orgId, handoffId);
  if (!handoff) return [];

  const lineUserId = handoff.customerLineId;
  if (!lineUserId) return [];

  const { items } = await listConversationFeedbackByUserId(orgId, lineUserId, { limit: 100 });
  const result: KnowledgeItem[] = [];

  for (let i = 0; i < items.length - 1; i++) {
    const curr = items[i]!;
    const next = items[i + 1]!;
    const question = (curr.userMessage ?? "").trim();
    const answer = (next.botReply ?? "").trim();
    const isStaffAnswer = next.source === "admin" || next.adminSentBy;

    if (!question || !answer || !isStaffAnswer) continue;
    if (!QUESTION_INDICATORS.test(question)) continue;

    const confidence = qaConfidence(question, answer);
    result.push({
      type: "qa",
      question,
      answer,
      confidence,
      rawQuestion: question,
      rawAnswer: answer,
    });
  }

  for (const item of items) {
    const reply = (item.botReply ?? "").trim();
    if (item.source !== "admin" && !item.adminSentBy) continue;
    const matches = [...reply.matchAll(PRICING_REGEX)];
    for (const m of matches) {
      const service = (m[1] ?? "").trim();
      const price = (m[2] ?? "").replace(/,/g, "");
      if (service.length >= 2 && price.length >= 1) {
        result.push({
          type: "pricing",
          service,
          price,
          details: reply.slice(0, 300),
          confidence: 0.7,
        });
      }
    }
  }

  return result;
}

/** Format for knowledge base — Q&A */
export function formatQAKnowledge(item: KnowledgeItem): string {
  if (item.type === "qa" && item.question && item.answer) {
    return `คำถาม: ${item.question}\nคำตอบ: ${item.answer}`;
  }
  return "";
}

/** Format for knowledge base — Pricing */
export function formatPricingKnowledge(item: KnowledgeItem): string {
  if (item.type === "pricing" && item.service && item.price) {
    return `บริการ: ${item.service}\nราคา: ${item.price} บาท`;
  }
  return "";
}
