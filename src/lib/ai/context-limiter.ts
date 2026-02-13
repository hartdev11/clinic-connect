/**
 * Phase 3 #6 — Deterministic Context Limiter
 * Max tokens, sort by relevance, remove redundant, always include risks/contraindications/disclaimer
 */
import type { StructuredKnowledgeContext } from "@/types/knowledge-brain";

const MAX_CONTEXT_CHARS = 4500; // ~1125 tokens @ 4 chars/token
const ESTIMATED_CHARS_PER_TOKEN = 4;

export interface LimitedContext {
  content: string;
  truncated: boolean;
  includesRisks: boolean;
  includesContraindications: boolean;
  includesDisclaimer: boolean;
}

/** Required fields — always include */
const REQUIRED_KEYS = ["risks", "contraindications", "disclaimer"] as const;

export function limitContext(
  ctx: Record<string, unknown>,
  mandatoryDisclaimer: string,
  maxChars: number = MAX_CONTEXT_CHARS
): LimitedContext {
  const risks = (ctx.risks as string[] | undefined) ?? [];
  const contraindications = (ctx.contraindications as string[] | undefined) ?? [];
  const disclaimer = (ctx.disclaimer as string | undefined)?.trim() || mandatoryDisclaimer;

  const parts: string[] = [];
  parts.push(`risks: ${risks.join("; ") || mandatoryDisclaimer}`);
  parts.push(`contraindications: ${contraindications.join("; ") || "กรุณาปรึกษาแพทย์ก่อน"}`);
  parts.push(`disclaimer: ${disclaimer}`);

  const optionalOrder = ["service_name", "category", "suitable_for", "not_suitable_for", "clinic_brand", "price_range", "differentiator"];
  for (const k of optionalOrder) {
    const v = ctx[k];
    if (v == null || v === "") continue;
    const str = Array.isArray(v) ? (v as string[]).join(", ") : String(v);
    parts.push(`${k}: ${str}`);
  }

  let content = parts.join("\n");
  const truncated = content.length > maxChars;
  if (truncated) {
    content = content.slice(0, maxChars - 20) + "\n...[truncated]";
  }

  return {
    content,
    truncated,
    includesRisks: risks.length > 0 || !!disclaimer,
    includesContraindications: contraindications.length > 0,
    includesDisclaimer: !!disclaimer,
  };
}
