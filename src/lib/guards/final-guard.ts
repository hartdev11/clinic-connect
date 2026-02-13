/**
 * ✅ FINAL GUARD SET — ป้องกันการ "ข้ามขั้น / ตอบผิดบริบท"
 * 
 * เป้าหมาย:
 * ❌ ไม่เดา
 * ❌ ไม่หลุด other / unknown
 * ❌ ไม่ลืม context
 * ❌ ไม่ข้ามขั้น
 * ✅ คุยเหมือนแอดมินจริง
 */
import type { ConversationState } from "../agents/conversation-state";

/**
 * Guard Result — ใช้ return enum แทน throw Error
 * เพื่อให้รู้ว่า fail เพราะอะไร และไม่ crash
 */
export type GuardResult =
  | { ok: true; text: string }
  | { ok: false; reason: "ILLEGAL_TEXT" | "PRICE_WITHOUT_SERVICE" | "PRICE_WITHOUT_AREA" | "ASK_AREA_AGAIN" | "STAGE_MISMATCH" };

/**
 * Final Guard: ตรวจสอบ reply ก่อนส่งให้ลูกค้า
 * 
 * กฎเหล็ก:
 * - ❌ ห้ามมีคำว่า other, unknown
 * - ❌ ห้ามให้ราคา ถ้ายังไม่รู้ service
 * - ❌ ห้ามให้ราคา ถ้าต้องรู้ area แต่ยังไม่มี
 * - ❌ ห้ามมีข้อความที่ผิดบริบท
 * - ❌ ห้ามถาม area ซ้ำ ถ้ามี area แล้ว
 * - ❌ ห้ามข้ามขั้น (stage control)
 */
export function finalGuard(
  state: ConversationState,
  replyText: string
): GuardResult {
  // ตรวจสอบ illegal patterns
  const illegalPatterns = [
    "other",
    "unknown",
    "ทำได้หลายบริเวณ", // ถ้ามี area แล้ว ห้ามถามซ้ำ
    "ทั้งหน้า body", // ไม่สมเหตุสมผล
  ];

  for (const pattern of illegalPatterns) {
    if (replyText.toLowerCase().includes(pattern.toLowerCase())) {
      return { ok: false, reason: "ILLEGAL_TEXT" };
    }
  }

  // ❌ ห้ามให้ราคา ถ้ายังไม่รู้ service
  if (!state.service && /ราคา|บาท/.test(replyText)) {
    return { ok: false, reason: "PRICE_WITHOUT_SERVICE" };
  }

  // ❌ ห้ามให้ราคา ถ้าต้องรู้ area แต่ยังไม่มี
  if (
    state.service &&
    requiresArea(state.service) &&
    !state.area &&
    state.area !== "unknown" &&
    /ราคา|บาท/.test(replyText)
  ) {
    return { ok: false, reason: "PRICE_WITHOUT_AREA" };
  }

  // ❌ ห้ามถาม area ซ้ำ ถ้ามี area แล้ว
  if (
    state.area &&
    state.area !== "unknown" &&
    /สนใจทำบริเวณไหน|ทำบริเวณไหน|บริเวณไหน/.test(replyText)
  ) {
    return { ok: false, reason: "ASK_AREA_AGAIN" };
  }

  // 🔥 Stage Control — ห้ามข้ามขั้น (สำคัญมาก)
  // กฎเหล็ก:
  // - stage < service_selected → ❌ ห้ามราคา
  // - stage < area_selected → ❌ ห้าม pricing สำหรับ filler/botox
  // - refinement → ❌ ห้ามเปลี่ยน stage
  
  // stage < service_selected → ❌ ห้ามราคา
  if (
    (state.stage === "exploring" || state.stage === "greeting") &&
    /ราคา|บาท/.test(replyText)
  ) {
    return { ok: false, reason: "STAGE_MISMATCH" };
  }

  // stage < area_selected → ❌ ห้าม pricing สำหรับ filler/botox
  // ถ้ายังอยู่ใน service_selected แต่ให้ราคา → ไม่ถูกต้อง
  if (
    state.stage === "service_selected" &&
    requiresArea(state.service) &&
    !state.area &&
    state.area !== "unknown" &&
    /ราคา|บาท/.test(replyText)
  ) {
    return { ok: false, reason: "STAGE_MISMATCH" };
  }
  
  // ถ้า stage = pricing แต่ไม่มี service/area → ไม่ถูกต้อง
  if (
    state.stage === "pricing" &&
    (!state.service || (!state.area && requiresArea(state.service)))
  ) {
    // ถ้า reply มีราคา → ไม่ถูกต้อง
    if (/ราคา|บาท/.test(replyText)) {
      return { ok: false, reason: "STAGE_MISMATCH" };
    }
  }

  return { ok: true, text: replyText };
}

/**
 * เช็คว่า service นี้ต้องรู้ area ก่อนให้ราคาหรือไม่
 */
function requiresArea(service?: string): boolean {
  if (!service) return false;
  const serviceStr = String(service).toLowerCase();
  // บริการที่ต้องรู้ area ก่อนให้ราคา
  return ["filler", "botox", "rejuran", "laser"].includes(serviceStr);
}
