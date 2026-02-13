/**
 * Enterprise: Prompt Injection Protection
 * Sanitize user input before sending to LLM — truncate, strip injection patterns
 */
const MAX_USER_INPUT_CHARS = 800;
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions?/gi,
  /disregard\s+(?:all\s+)?(?:previous|above)\s+instructions?/gi,
  /forget\s+(?:everything|all)\s+(?:you|above)/gi,
  /คุณคือ|you are now|act as if you are|pretend you are/gi,
  /system\s*:\s*|assistant\s*:\s*/gi,
  /\[INST\]|\[\/INST\]|<<SYS>>|<<\/SYS>>/gi,
  /reveal\s+(?:your|the)\s+(?:prompt|instructions|system)/gi,
  /show\s+me\s+your\s+prompt/gi,
  /repeat\s+the\s+above\s+(?:in|back)/gi,
  /輸出|輸出你的|print\s+your\s+prompt/gi,
  /\\n\\nHuman:|\\n\\nAssistant:/g,
  /^```(?:json|text)?\s*$/gm,
];

/** Sanitize user message — prevent prompt injection, limit length */
export function sanitizeForLLM(userMessage: string): string {
  if (!userMessage || typeof userMessage !== "string") return "";
  let s = userMessage.trim();
  for (const p of INJECTION_PATTERNS) {
    s = s.replace(p, " ").trim();
  }
  // Remove excessive newlines
  s = s.replace(/\n{4,}/g, "\n\n\n");
  // Truncate
  if (s.length > MAX_USER_INPUT_CHARS) {
    s = s.slice(0, MAX_USER_INPUT_CHARS - 3) + "...";
  }
  s = s.trim();
  // If sanitization stripped everything (injection attempt), use safe truncation of original
  if (!s && userMessage.trim().length > 0) {
    s = userMessage.trim().slice(0, 300).replace(/[\n\r]+/g, " ");
  }
  return s;
}
