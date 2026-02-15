/**
 * On promotion save: call OpenAI once to generate aiSummary (2 lines) and aiTags (keywords).
 * Store result in document.
 */
import { getOpenAI } from "@/lib/agents/clients";

export interface PromotionAISummaryResult {
  aiSummary: string;
  aiTags: string[];
}

export async function generatePromotionAISummary(
  name: string,
  description?: string,
  imageSummary?: string
): Promise<PromotionAISummaryResult | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  const prompt = `You are a marketing assistant. Given a promotion name, optional description, and optional summary from an image, output:
1. aiSummary: exactly 2 short lines in Thai, summarizing the promotion for customers (include image content if provided).
2. aiTags: 3-8 keywords in Thai or English for search (e.g. โปรจมูก, ฟิลเลอร์, โบท็อกซ์, ลดราคา). No hardcoded categories.

Name: ${name}
${description ? `Description: ${description.slice(0, 500)}` : ""}
${imageSummary ? `From image: ${imageSummary.slice(0, 300)}` : ""}

Respond with valid JSON only: {"aiSummary":"line1\\nline2","aiTags":["tag1","tag2",...]}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.3,
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { aiSummary?: string; aiTags?: string[] };
    const aiSummary = typeof parsed.aiSummary === "string" ? parsed.aiSummary.trim().slice(0, 300) : "";
    const aiTags = Array.isArray(parsed.aiTags) ? parsed.aiTags.slice(0, 8).map((t) => String(t).trim()).filter(Boolean) : [];
    return aiSummary ? { aiSummary, aiTags } : null;
  } catch {
    return null;
  }
}
