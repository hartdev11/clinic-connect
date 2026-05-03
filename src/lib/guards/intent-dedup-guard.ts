import type { ConversationState } from "../agents/conversation-state";
import type { IntentType } from "../agents/types";
import {
  isAskingForOtherPromotionsCount,
  isExplicitPromotionListingAsk,
  isPromotionDetailScopeAsk,
  isPromotionOpinionOrSuitabilityAsk,
} from "../agents/promotion-listing-intent";

/**
 * Intent Deduplication Guard
 * 
 * 🔑 ป้องกันการถามซ้ำเมื่อลูกค้าพิมพ์ข้อความที่ความหมายเหมือนเดิม
 * 
 * กฎเหล็ก:
 * ❌ ข้อความใหม่ ≠ state ใหม่เสมอ
 * ✅ ถ้าความหมายเท่าเดิม → ห้าม reset flow
 * 
 * ตัวอย่าง:
 * - "สนใจทำจมูก" → service = surgery, area = nose
 * - "อยากทำจมูก" → ถ้า intent, service, area เหมือนเดิม → ห้ามถามซ้ำ
 * 
 * @param prevState State ก่อนหน้า
 * @param intent Intent ที่ detect ได้จากข้อความใหม่
 * @param nextState State หลัง update
 * @returns true ถ้าซ้ำ (ห้ามถามซ้ำ), false ถ้าไม่ซ้ำ (ถามได้)
 */
export function intentDedupGuard(
  prevState: ConversationState,
  intent: IntentType,
  nextState: ConversationState,
  opts?: { userMessage?: string }
): boolean {
  if (
    opts?.userMessage &&
    (isExplicitPromotionListingAsk(opts.userMessage) ||
      isAskingForOtherPromotionsCount(opts.userMessage) ||
      isPromotionDetailScopeAsk(opts.userMessage) ||
      isPromotionOpinionOrSuitabilityAsk(opts.userMessage))
  ) {
    return false;
  }
  // ถ้าไม่มี state ก่อนหน้า → ไม่ซ้ำ (ถามได้)
  if (!prevState.service && !prevState.area) {
    return false;
  }

  // ถ้า intent เปลี่ยน → ไม่ซ้ำ (ถามได้)
  if (prevState.intent !== intent) {
    return false;
  }

  // ถ้า service หรือ area เปลี่ยน → ไม่ซ้ำ (ถามได้)
  if (
    prevState.service !== nextState.service ||
    prevState.area !== nextState.area
  ) {
    return false;
  }

  // ถ้า stage เปลี่ยน → ไม่ซ้ำ (ถามได้)
  // เช่น จาก exploring → service_selected → ไม่ซ้ำ
  if (prevState.stage !== nextState.stage) {
    return false;
  }

  // ถ้าทุกอย่างเหมือนเดิม → ซ้ำ (ห้ามถามซ้ำ)
  // นี่คือกรณีที่ลูกค้าพิมพ์ข้อความที่ความหมายเหมือนเดิม
  // เช่น "สนใจทำจมูก" แล้วพิมพ์ "อยากทำจมูก" อีกครั้ง
  return true;
}

/**
 * สร้าง reply สั้น ๆ สำหรับกรณีที่ detect ซ้ำ
 * ไม่ถามซ้ำ แต่ตอบรับเพื่อให้รู้ว่าระบบเข้าใจ
 */
export function composeDedupReply(state: ConversationState): string {
  // ถ้ามี preference.style แล้ว → ตอบตาม preference
  if (state.service === "surgery" && state.area === "nose" && state.preference?.style) {
    const style = state.preference.style;
    if (style === "ธรรมชาติ") {
      return `ได้เลยค่ะ 😊 ธรรมชาติหรือเกาหลีดีคะ`;
    } else if (style === "โด่ง" || style === "ปลายพุ่ง") {
      return `ได้เลยค่ะ 😊 อยากได้สันชัดแค่ไหนคะ`;
    } else if (style === "สายเกาหลี") {
      return `ได้เลยค่ะ 😊 เกาหลีหรือธรรมชาติดีคะ`;
    }
  }

  // ถ้ายังไม่มี preference → ถามสั้น ๆ
  if (state.service === "surgery" && state.area === "nose") {
    return `ได้เลยค่ะ 😊 ธรรมชาติหรือเกาหลีดีคะ`;
  }

  // Default: ตอบรับสั้น ๆ
  return `ได้เลยค่ะ 😊`;
}
