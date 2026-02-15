/**
 * AI Media Intelligence — scan promotion image with OpenAI Vision.
 * Extract: procedure type, keywords, price, discount, benefits, urgency, disclaimers.
 * No manual procedure selection; supports ALL procedures (จมูก, ฟิลเลอร์, โบท็อกซ์, เลเซอร์, etc.).
 */
import { getOpenAI } from "@/lib/agents/clients";

export interface PromotionImageExtraction {
  extractedProcedures: string[];
  extractedKeywords: string[];
  extractedBenefits: string[];
  extractedPrice?: number;
  extractedDiscount?: number;
  urgencyScore?: number;
  /** Raw text summary for aiSummary regeneration */
  imageSummary?: string;
}

const EXTRACTION_PROMPT = `You are a medical/aesthetic clinic marketing analyst. Analyze this promotion image and extract structured data in Thai or English.

Extract:
1. extractedProcedures: list of procedure types (e.g. โปรจมูก, ฟิลเลอร์, โบท็อกซ์, เลเซอร์, ลดไขมัน, ผ่าตัดเสริมจมูก, ฉีด filler). Include ALL mentioned procedures.
2. extractedKeywords: 5-12 keywords for search (e.g. โปรจมูก, จมูก, filler, botox, ลดราคา, จำกัดเวลา).
3. extractedBenefits: benefits or selling points mentioned (e.g. ราคาพิเศษ, ฟรีค่าห้องผ่าตัด).
4. extractedPrice: numeric price in THB if visible (number only), else null.
5. extractedDiscount: discount percentage if visible (number 0-100), else null.
6. urgencyScore: 0-10 how urgent/limited the offer seems (10 = limited time, flash sale).
7. imageSummary: 1-2 sentences in Thai summarizing what the image says (for AI to use in replies).

If the image is not a promotion or has no medical/procedure content, return empty arrays and nulls.
Respond with valid JSON only: {"extractedProcedures":[],"extractedKeywords":[],"extractedBenefits":[],"extractedPrice":null,"extractedDiscount":null,"urgencyScore":null,"imageSummary":null}`;

export type ScanPromotionImageResult =
  | { ok: true; data: PromotionImageExtraction }
  | { ok: false; reason: string };

export async function scanPromotionImage(imageUrl: string): Promise<PromotionImageExtraction | null> {
  const result = await scanPromotionImageWithReason(imageUrl);
  return result.ok ? result.data : null;
}

export async function scanPromotionImageWithReason(imageUrl: string): Promise<ScanPromotionImageResult> {
  const openai = getOpenAI();
  if (!openai) {
    return { ok: false, reason: "OPENAI_API_KEY is not set in .env.local" };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 600,
      temperature: 0.2,
    });
    let raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return { ok: false, reason: "OpenAI returned no content (model may have refused or failed)" };
    }
    // Strip markdown code block if present (e.g. ```json ... ```)
    const codeBlockMatch = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
    if (codeBlockMatch) raw = codeBlockMatch[1].trim();
    const parsed = JSON.parse(raw) as {
      extractedProcedures?: string[];
      extractedKeywords?: string[];
      extractedBenefits?: string[];
      extractedPrice?: number | null;
      extractedDiscount?: number | null;
      urgencyScore?: number | null;
      imageSummary?: string | null;
    };
    return {
      ok: true,
      data: {
        extractedProcedures: Array.isArray(parsed.extractedProcedures) ? parsed.extractedProcedures.slice(0, 15) : [],
        extractedKeywords: Array.isArray(parsed.extractedKeywords) ? parsed.extractedKeywords.slice(0, 15) : [],
        extractedBenefits: Array.isArray(parsed.extractedBenefits) ? parsed.extractedBenefits.slice(0, 10) : [],
        extractedPrice: typeof parsed.extractedPrice === "number" ? parsed.extractedPrice : undefined,
        extractedDiscount: typeof parsed.extractedDiscount === "number" ? parsed.extractedDiscount : undefined,
        urgencyScore: typeof parsed.urgencyScore === "number" ? Math.min(10, Math.max(0, parsed.urgencyScore)) : undefined,
        imageSummary: typeof parsed.imageSummary === "string" ? parsed.imageSummary.slice(0, 300) : undefined,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: message.includes("api_key") || message.includes("API key")
        ? "Invalid or missing OpenAI API key"
        : message.includes("fetch") || message.includes("URL") || message.includes("image")
          ? `OpenAI could not fetch image (check URL is public): ${message.slice(0, 120)}`
          : message.slice(0, 200),
    };
  }
}
