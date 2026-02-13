/**
 * Phase 3 #2 — Answer Constraint Engine (Anti-Hallucination Layer)
 * Freeze context, schema-based enforcement, disallow generation outside provided fields
 */
import type { StructuredKnowledgeContext } from "@/types/knowledge-brain";

export const RESPONSE_CONTRACT =
  "ห้ามสร้างข้อมูลที่ไม่มีใน structured context ต้องตอบเฉพาะจาก context ที่ให้เท่านั้น";

/** Required fields that MUST be in context — no free-form */
const REQUIRED_FIELDS = ["risks", "contraindications", "disclaimer"] as const;

export interface FrozenContext {
  service_name: string;
  category: string;
  suitable_for: string[];
  not_suitable_for: string[];
  risks: string[];
  contraindications: string[];
  disclaimer: string;
  [key: string]: unknown;
}

/** Freeze & validate context — ensures risks, contraindications, disclaimer present */
export function freezeAndValidateContext(
  ctx: Record<string, unknown>,
  mandatoryDisclaimer: string
): FrozenContext {
  const risks = (ctx.risks as string[] | undefined) ?? [];
  const contraindications = (ctx.contraindications as string[] | undefined) ?? [];
  const disclaimer = (ctx.disclaimer as string | undefined)?.trim() || mandatoryDisclaimer;

  return Object.freeze({
    service_name: String(ctx.service_name ?? ""),
    category: String(ctx.category ?? ""),
    suitable_for: Array.isArray(ctx.suitable_for) ? [...ctx.suitable_for] : [],
    not_suitable_for: Array.isArray(ctx.not_suitable_for) ? [...ctx.not_suitable_for] : [],
    risks: risks.length > 0 ? risks : [mandatoryDisclaimer],
    contraindications: contraindications.length > 0 ? contraindications : ["กรุณาปรึกษาแพทย์ก่อน"],
    disclaimer,
    ...Object.fromEntries(
      Object.entries(ctx).filter(
        ([k]) => !["risks", "contraindications", "disclaimer", "service_name", "category", "suitable_for", "not_suitable_for"].includes(k)
      )
    ),
  }) as FrozenContext;
}

/** Build deterministic context for LLM — sort by relevance, no free-form concat */
export function buildDeterministicContext(
  ctx: FrozenContext,
  maxChars: number
): string {
  const parts: string[] = [
    `service: ${ctx.service_name}`,
    `category: ${ctx.category}`,
    `suitable_for: ${ctx.suitable_for.join(", ")}`,
    `not_suitable_for: ${ctx.not_suitable_for.join(", ")}`,
    `risks: ${ctx.risks.join("; ")}`,
    `contraindications: ${ctx.contraindications.join("; ")}`,
    `disclaimer: ${ctx.disclaimer}`,
  ];

  let out = parts.filter(Boolean).join("\n");
  if (out.length > maxChars) {
    out = out.slice(0, maxChars - 20) + "\n...[truncated]";
  }
  return out;
}

/** Validate reply does not contain fabricated numbers/claims (heuristic) */
const FABRICATION_PATTERNS = [
  /\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*บาท(?!\s*จาก context)/i,
  /รับประกัน\s*(?:100%|แน่นอน|ผล)/i,
  /วินิจฉัยว่า|วินิจฉัยได้ว่า/i,
];

export function validateOutputAgainstContext(
  reply: string,
  contextSummary: string
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const p of FABRICATION_PATTERNS) {
    if (p.test(reply)) {
      violations.push("Reply contains unverified claim");
      break;
    }
  }

  const valid = violations.length === 0;
  return { valid, violations };
}

/**
 * Enterprise: Self-Consistency Check — Rule-based validation
 * Verify reply key facts exist in context; reject fabricated numbers/claims
 */
export function selfConsistencyCheck(reply: string, contextSummary: string): boolean {
  if (!reply?.trim() || !contextSummary?.trim()) return true;

  // 1. Fabrication patterns — instant reject
  for (const p of FABRICATION_PATTERNS) {
    if (p.test(reply)) return false;
  }

  // 2. Price numbers — reply มีตัวเลขบาทต้องมีใน context (รองรับ range 5,000-10,000)
  const extractPrices = (text: string): Set<string> => {
    const nums = new Set<string>();
    const priceLike = /(\d{1,6}(?:,\d{3})*)\s*(?:บาท|baht|price|ราคา|-|ถึง|จาก)/gi;
    for (const m of text.matchAll(priceLike)) {
      nums.add(m[1]!.replace(/,/g, ""));
    }
    const rangeLike = /(\d{1,6}(?:,\d{3})*)\s*[-–]\s*(\d{1,6}(?:,\d{3})*)/gi;
    for (const m of text.matchAll(rangeLike)) {
      nums.add(m[1]!.replace(/,/g, ""));
      nums.add(m[2]!.replace(/,/g, ""));
    }
    const anyPrice = /(\d{1,6}(?:,\d{3})*)(?=\s*(?:บาท|baht|-|ถึง|$))/gi;
    for (const m of text.matchAll(anyPrice)) {
      nums.add(m[1]!.replace(/,/g, ""));
    }
    return nums;
  };

  const contextPrices = extractPrices(contextSummary);
  const replyPrices = [...reply.matchAll(/(\d{1,6}(?:,\d{3})*)\s*บาท/gi)].map((m) =>
    m[1]!.replace(/,/g, "")
  );
  if (replyPrices.length > 0 && contextPrices.size === 0) return false;
  for (const rp of replyPrices) {
    const rpNum = parseInt(rp, 10);
    if (isNaN(rpNum)) continue;
    const found = [...contextPrices].some((cp) => {
      const cpNum = parseInt(cp, 10);
      return cp === rp || (!isNaN(cpNum) && Math.abs(cpNum - rpNum) < 100);
    });
    if (!found) return false;
  }

  return true;
}
