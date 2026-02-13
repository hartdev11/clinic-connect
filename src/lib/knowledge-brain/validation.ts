/**
 * Enterprise Knowledge Brain — Validation Layer
 * Reject invalid clinic_knowledge before save
 */
import type { ClinicKnowledgeCreate, ClinicKnowledgeUpdate, GlobalKnowledge } from "@/types/knowledge-brain";
import type { ValidationError } from "@/types/knowledge-brain";

const FORBIDDEN_PHRASES = [/รับประกัน\s*100%|รับประกันแน่นอน/i];
const MIN_DESCRIPTION_LENGTH = 200;

function validateGlobalFields(
  g: Pick<GlobalKnowledge, "suitable_for" | "not_suitable_for" | "risks" | "description">
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!g.suitable_for?.length) errors.push({ field: "suitable_for", message: "ต้องไม่ว่าง" });
  if (!g.not_suitable_for?.length) errors.push({ field: "not_suitable_for", message: "ต้องไม่ว่าง" });
  if (!g.risks?.length) errors.push({ field: "risks", message: "ต้องไม่ว่าง" });
  if ((g.description?.length ?? 0) < MIN_DESCRIPTION_LENGTH) {
    errors.push({ field: "description", message: `ต้องไม่ต่ำกว่า ${MIN_DESCRIPTION_LENGTH} ตัวอักษร` });
  }
  const text = g.description ?? "";
  for (const p of FORBIDDEN_PHRASES) {
    if (p.test(text)) {
      errors.push({ field: "description", message: "ห้ามมีคำว่า รับประกัน 100%" });
      break;
    }
  }
  return errors;
}

function validateTextFields(texts: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const combined = texts.filter(Boolean).join(" ");
  for (const p of FORBIDDEN_PHRASES) {
    if (p.test(combined)) {
      errors.push({ field: "content", message: "ห้ามมีคำว่า รับประกัน 100%" });
      break;
    }
  }
  return errors;
}

/** Validate clinic_knowledge create — ต้อง merge กับ global ก่อน validate */
export function validateClinicKnowledgeCreate(
  data: ClinicKnowledgeCreate,
  globalDoc: GlobalKnowledge | null
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!data.org_id?.trim()) {
    errors.push({ field: "org_id", message: "org_id ต้องมีค่า" });
  }
  if (!data.base_service_id?.trim()) {
    errors.push({ field: "base_service_id", message: "base_service_id ต้องมีค่า" });
  }

  if (globalDoc) {
    const globalErrors = validateGlobalFields(globalDoc);
    errors.push(...globalErrors);

    const customTexts = [
      data.custom_brand,
      data.custom_price_range,
      data.custom_differentiator,
      data.custom_notes,
    ].filter(Boolean) as string[];
    errors.push(...validateTextFields(customTexts));
  } else {
    errors.push({ field: "base_service_id", message: "ไม่พบ global service" });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Validate clinic_knowledge update */
export function validateClinicKnowledgeUpdate(
  data: ClinicKnowledgeUpdate,
  globalDoc: GlobalKnowledge | null
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (globalDoc) {
    const customTexts = [
      data.custom_brand,
      data.custom_price_range,
      data.custom_differentiator,
      data.custom_notes,
    ].filter(Boolean) as string[];
    errors.push(...validateTextFields(customTexts));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
