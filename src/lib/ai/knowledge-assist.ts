/**
 * Knowledge Assist — AI helps clinic admin write knowledge entries.
 * Thai, professional medical tone, no diagnosis/guarantees/revenue. Max 300 words.
 * workloadType: knowledge_assist. Separate from customer chat circuit.
 */
import { getOpenAI } from "@/lib/agents/clients";
import { recordLLMUsage } from "@/lib/llm-metrics";

const SYSTEM_PROMPT = `You are a professional medical-beauty clinic content assistant. Write in Thai only.
Rules:
- Professional, warm tone. No diagnosis. No guarantees. No revenue or profit references.
- Max 300 words total.
- Output valid JSON only, no markdown or extra text.
- Structure: { "summary": "1–2 sentences", "keyPoints": ["bullet 1", "bullet 2", ...], "sampleQuestions": ["question 1", "question 2", "question 3"] }
- keyPoints: 3–5 short bullets. sampleQuestions: exactly 3 example customer questions in Thai.`;

const MODEL = (typeof process !== "undefined" && process.env?.KNOWLEDGE_ASSIST_MODEL) || "gpt-4o-mini";
const MAX_TOKENS = 800;
const TEMPERATURE = 0.4;

export interface KnowledgeAssistResult {
  summary: string;
  keyPoints: string[];
  sampleQuestions: string[];
}

export async function generateKnowledgeAssist(
  topic: string,
  category: string,
  optionalHint: string | undefined,
  options?: { orgId?: string }
): Promise<KnowledgeAssistResult> {
  const openai = getOpenAI();
  if (!openai) {
    return { summary: "", keyPoints: [], sampleQuestions: [] };
  }
  const userContent = [
    `หัวข้อ: ${topic}`,
    `ประเภท: ${category}`,
    optionalHint?.trim() ? `คำใบ้เพิ่มเติม: ${optionalHint.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });
    const text = completion.choices[0]?.message?.content?.trim();
    const usage = completion.usage
      ? {
          prompt_tokens: completion.usage.prompt_tokens ?? 0,
          completion_tokens: completion.usage.completion_tokens ?? 0,
          total_tokens: completion.usage.total_tokens ?? 0,
        }
      : undefined;
    if (options?.orgId && usage) {
      recordLLMUsage(options.orgId, usage, { workloadType: "knowledge_assist" }).catch((e) =>
        console.error("[knowledge-assist] recordLLMUsage:", e)
      );
    }
    if (!text) return { summary: "", keyPoints: [], sampleQuestions: [] };
    const parsed = JSON.parse(text) as { summary?: string; keyPoints?: string[]; sampleQuestions?: string[] };
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      sampleQuestions: Array.isArray(parsed.sampleQuestions) ? parsed.sampleQuestions : [],
    };
  } catch (err) {
    console.error("[knowledge-assist]", err);
    return { summary: "", keyPoints: [], sampleQuestions: [] };
  }
}
