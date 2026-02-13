/**
 * Phase 3 #3 — Knowledge Quality AI Review
 * LLM internal reviewer (low-cost) on submit: logical consistency, safety, vague language, exaggerated claims
 */
import { getOpenAI } from "@/lib/agents/clients";
import type { GlobalKnowledge, ClinicKnowledge } from "@/types/knowledge-brain";

const REVIEW_MODEL = "gpt-4o-mini";
const MAX_TOKENS = 500;

export interface AIReviewResult {
  ai_review_score: number; // 0-100
  ai_review_notes: string;
  issues: string[];
  passed: boolean;
}

function buildReviewContent(global: GlobalKnowledge, clinic: ClinicKnowledge | null): string {
  const parts = [
    `Service: ${global.service_name}`,
    `Category: ${global.category}`,
    `Description: ${global.description}`,
    `Risks: ${global.risks.join("; ")}`,
    `Contraindications: ${global.contraindications.join("; ")}`,
  ];
  if (clinic?.custom_brand) parts.push(`Brand: ${clinic.custom_brand}`);
  if (clinic?.custom_differentiator) parts.push(`Differentiator: ${clinic.custom_differentiator}`);
  if (clinic?.custom_notes) parts.push(`Notes: ${clinic.custom_notes}`);
  return parts.join("\n");
}

export async function runAIQualityReview(
  global: GlobalKnowledge,
  clinic: ClinicKnowledge | null
): Promise<AIReviewResult> {
  const openai = getOpenAI();
  if (!openai) {
    return {
      ai_review_score: 50,
      ai_review_notes: "AI review skipped: OpenAI not configured",
      issues: [],
      passed: true,
    };
  }

  const content = buildReviewContent(global, clinic);

  const systemPrompt = `คุณเป็นผู้ตรวจสอบเนื้อหาคลินิกความงาม ตรวจสอบความสอดคล้องทางตรรกะ การครอบคลุมความปลอดภัย ภาษาที่คลุมเครือ และคำกล่าวอ้างที่เกินจริง
ตอบเป็น JSON เท่านั้น:
{"score": 0-100, "issues": ["รายการปัญหา"], "notes": "สรุปสั้นๆ"}
- score ต่ำถ้ามี: logical inconsistency, missing safety coverage, vague language, exaggerated claims
- score สูงถ้าครบถ้วน ชัดเจน ไม่เกินจริง`;

  try {
    const completion = await openai.chat.completions.create({
      model: REVIEW_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `ตรวจสอบเนื้อหานี้:\n\n${content.slice(0, 3000)}` },
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.2,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const json = JSON.parse(text.replace(/```json?\s*/g, "").replace(/```\s*$/g, "")) as {
      score?: number;
      issues?: string[];
      notes?: string;
    };

    const score = Math.min(100, Math.max(0, Number(json.score) ?? 50));
    const issues = Array.isArray(json.issues) ? json.issues : [];
    const notes = String(json.notes ?? "");

    return {
      ai_review_score: score,
      ai_review_notes: notes || (issues.length ? issues.join("; ") : "ผ่านการตรวจสอบ"),
      issues,
      passed: score >= 60 && issues.filter((i) => i.toLowerCase().includes("exaggerat") || i.toLowerCase().includes("เกินจริง")).length === 0,
    };
  } catch (err) {
    console.warn("[AIQualityReview] Error:", (err as Error)?.message?.slice(0, 80));
    return {
      ai_review_score: 50,
      ai_review_notes: `Review error: ${(err as Error)?.message?.slice(0, 100)}`,
      issues: [],
      passed: true, // fail-open to not block workflow
    };
  }
}
