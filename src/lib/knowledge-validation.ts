/**
 * Knowledge input validation — Enterprise redesign
 * Financial terms warning + 5,000 character limit per entry
 */

const FINANCIAL_TERMS = [
  "รายได้",
  "กำไร",
  "ต้นทุน",
  "revenue",
  "profit",
  "cost",
  "margin",
];

const MAX_CONTENT_LENGTH = 5000;

export interface ValidationResult {
  valid: boolean;
  financialWarning?: boolean;
  message?: string;
}

/** Check if content contains financial terms (Thai + English). */
export function hasFinancialTerms(text: string): boolean {
  const lower = text.toLowerCase().trim();
  for (const term of FINANCIAL_TERMS) {
    if (lower.includes(term.toLowerCase())) return true;
  }
  return false;
}

/** Validate content length (max 5,000 chars). */
export function validateContentLength(content: string): boolean {
  return content.length <= MAX_CONTENT_LENGTH;
}

export function getMaxContentLength(): number {
  return MAX_CONTENT_LENGTH;
}

/** Full validation: length + financial terms. Returns needsConfirmation if financial terms found. */
export function validateKnowledgeContent(content: string): ValidationResult {
  if (!content.trim()) {
    return { valid: false, message: "กรุณากรอกรายละเอียด" };
  }
  if (!validateContentLength(content)) {
    return {
      valid: false,
      message: `รายละเอียดต้องไม่เกิน ${MAX_CONTENT_LENGTH.toLocaleString()} ตัวอักษร`,
    };
  }
  if (hasFinancialTerms(content)) {
    return {
      valid: true,
      financialWarning: true,
      message: "ข้อมูลด้านการเงินไม่ควรใส่ในส่วนนี้",
    };
  }
  return { valid: true };
}
