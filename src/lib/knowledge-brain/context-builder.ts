/**
 * Enterprise Knowledge Brain — Context Builder
 * Structured JSON only — ห้ามส่ง plain text ยาว ๆ เข้า LLM
 */
import type { GlobalKnowledge, ClinicKnowledge, StructuredKnowledgeContext } from "@/types/knowledge-brain";

/** Build structured context for LLM — ห้ามส่ง raw text ยาว */
export function buildStructuredContext(
  globalDoc: GlobalKnowledge,
  clinicDoc: ClinicKnowledge | null
): StructuredKnowledgeContext {
  return {
    service_name: globalDoc.service_name,
    category: globalDoc.category,
    suitable_for: globalDoc.suitable_for ?? [],
    not_suitable_for: globalDoc.not_suitable_for ?? [],
    risks: globalDoc.risks ?? [],
    contraindications: globalDoc.contraindications ?? [],
    clinic_brand: clinicDoc?.custom_brand ?? null,
    price_range: clinicDoc?.custom_price_range ?? null,
    differentiator: clinicDoc?.custom_differentiator ?? null,
    last_updated: clinicDoc?.updated_at ?? globalDoc.last_updated,
  };
}

/** Build array of structured contexts for batch */
export function buildStructuredContexts(
  items: Array<{ global: GlobalKnowledge; clinic: ClinicKnowledge | null }>
): StructuredKnowledgeContext[] {
  return items.map(({ global, clinic }) => buildStructuredContext(global, clinic));
}
