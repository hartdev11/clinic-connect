/**
 * Phase 3 #11 — Failsafe Mode
 * Pinecone down, Embedding fail, Confidence engine error → safe template
 */

export const FAILSAFE_MESSAGE =
  "เรื่องนี้ให้ทีมงานช่วยตรวจสอบให้จะดีกว่าค่ะ โทรหรือแชทมาคลินิกได้เลยนะคะ";

export function isFailsafeError(err: unknown): boolean {
  const msg = (err as Error)?.message?.toLowerCase() ?? "";
  return (
    msg.includes("pinecone") ||
    msg.includes("embedding") ||
    msg.includes("openai") ||
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("network") ||
    msg.includes("confidence")
  );
}
