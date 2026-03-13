/**
 * Phase 22 — Learning Agent
 * Quality evaluation for learned items (handoff → knowledge)
 */
import { getGemini } from "@/lib/agents/clients";

const MEDICAL_BEAUTY_TERMS =
  /โบท็อกซ์|ฟิลเลอร์|เลเซอร์|HIFU|ราคา|ฉีด|ยิงเลเซอร์|โฟกัส|เรเดียม/;

export interface EvaluateQualityInput {
  question: string;
  answer: string;
}

export interface EvaluateQualityResult {
  score: number;
  autoApprove: boolean;
  queueForReview: boolean;
  reject: boolean;
}


/**
 * evaluateQuality(question, answer) → score 0-1
 * Base: 0.5
 * +0.20 if 20 ≤ length(question) ≤ 200
 * +0.20 if 40 ≤ length(answer) ≤ 500
 * +0.20 if has medical/beauty terms
 * +0.40 Gemini quality check (0-10 scale → /10 × 0.4)
 */
export async function evaluateQuality(
  input: EvaluateQualityInput
): Promise<EvaluateQualityResult> {
  const { question, answer } = input;
  let score = 0.5;

  if (question.length >= 20 && question.length <= 200) score += 0.2;
  if (answer.length >= 40 && answer.length <= 500) score += 0.2;
  if (MEDICAL_BEAUTY_TERMS.test(question + answer)) score += 0.2;

  let geminiScore = 0.5;
  const gemini = getGemini();
  if (gemini) {
    try {
      const res = await gemini.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: `ประเมินคุณภาพคู่คำถาม-คำตอบจากแชทคลินิกความงาม (1-10):\nคำถาม: ${question.slice(0, 300)}\nคำตอบ: ${answer.slice(0, 400)}`,
        config: {
          maxOutputTokens: 20,
          temperature: 0.1,
        },
      });
      const text = (res?.text ?? "").trim();
      const m = text.match(/\d+/);
      if (m) {
        geminiScore = Math.min(10, Math.max(1, parseInt(m[0], 10))) / 10;
      }
    } catch {
      geminiScore = 0.5;
    }
  }
  score += geminiScore * 0.4;
  score = Math.min(1, Math.max(0, score));

  return {
    score,
    autoApprove: score > 0.9,
    queueForReview: score >= 0.5 && score <= 0.9,
    reject: score < 0.5,
  };
}
