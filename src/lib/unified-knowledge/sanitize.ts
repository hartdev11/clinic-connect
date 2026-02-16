/**
 * Pre-embed safety: strip HTML, max length, normalize whitespace, remove duplicate sentences.
 * Enterprise: validate medical claim keywords (blocklist only — no legal advice).
 */
const MAX_SERVICE_TEXT = 8000;
const MAX_FAQ_TEXT = 4000;

/** Strip HTML tags and decode entities */
export function stripHtml(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/** Normalize whitespace: collapse multiple spaces/newlines to single space */
export function normalizeWhitespace(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text.replace(/\s+/g, " ").trim();
}

/** Remove duplicate sentences (same line repeated) */
export function removeDuplicateSentences(text: string): string {
  if (!text || typeof text !== "string") return "";
  const lines = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  return lines
    .filter((line) => {
      const key = line.toLowerCase().slice(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
}

/** Blocklist of risky medical claim phrases (Thai/English) — configurable */
const MEDICAL_CLAIM_BLOCKLIST = [
  "รักษาได้แน่นอน",
  "รับประกันผล",
  "100% หาย",
  "ไม่มีผลข้างเคียง",
  "ปลอดภัยแน่นอน",
  "cure guaranteed",
  "no side effects guaranteed",
];

/** Check for blocklisted medical claim phrases; returns first match or null */
export function detectBlocklistedMedicalClaim(text: string): string | null {
  if (!text || typeof text !== "string") return null;
  const lower = text.toLowerCase();
  for (const phrase of MEDICAL_CLAIM_BLOCKLIST) {
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

export interface SanitizeResult {
  text: string;
  truncated: boolean;
  blocklistedClaim: string | null;
}

/**
 * Sanitize text before embedding: strip HTML, normalize, dedupe, enforce max length.
 * If blocklisted medical claim found, still return text but set blocklistedClaim (caller may warn or reject).
 */
export function sanitizeForEmbedding(
  text: string,
  maxLength: number = MAX_SERVICE_TEXT
): SanitizeResult {
  let t = stripHtml(text);
  t = normalizeWhitespace(t);
  t = removeDuplicateSentences(t);
  const blocklistedClaim = detectBlocklistedMedicalClaim(t);
  const truncated = t.length > maxLength;
  t = t.slice(0, maxLength);
  return { text: t.trim(), truncated, blocklistedClaim };
}

export function sanitizeServiceText(text: string): SanitizeResult {
  return sanitizeForEmbedding(text, MAX_SERVICE_TEXT);
}

export function sanitizeFaqText(text: string): SanitizeResult {
  return sanitizeForEmbedding(text, MAX_FAQ_TEXT);
}
