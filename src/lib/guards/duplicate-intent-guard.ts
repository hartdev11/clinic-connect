import type { ConversationState } from "../agents/conversation-state";
import type { IntentResult } from "../agents/types";
import {
  isAskingForOtherPromotionsCount,
  isExplicitPromotionListingAsk,
  isPromotionDetailScopeAsk,
  isPromotionOpinionOrSuitabilityAsk,
} from "../agents/promotion-listing-intent";

/**
 * Duplicate Intent Guard
 * 
 * 🔑 ป้องกันการถามซ้ำเมื่อลูกค้าพูดซ้ำ intent เดิม
 * 
 * แนวคิด:
 * ถ้า intent + service + area เหมือนเดิม
 * ❌ ห้าม reset flow
 * ❌ ห้ามถามซ้ำ
 * ✅ ตอบสั้น / acknowledge อย่างเดียว
 * 
 * ตัวอย่าง:
 * - "สนใจทำจมูก" → intent = promotion_inquiry, service = surgery, area = nose
 * - "อยากทำจมูก" → ถ้า intent + service + area เหมือนเดิม → ห้ามถามซ้ำ
 * 
 * @param prevState State ก่อนหน้า
 * @param intentResult Intent result จากข้อความใหม่
 * @returns true ถ้าซ้ำ (ห้ามถามซ้ำ), false ถ้าไม่ซ้ำ (ถามได้)
 */
export function isDuplicateIntent(
  prevState: ConversationState,
  intentResult: IntentResult,
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
  if (!prevState.intent || !prevState.service || !prevState.area) {
    return false;
  }

  // ถ้า intent + service + area เหมือนเดิม → ซ้ำ
  return (
    prevState.intent === intentResult.intent &&
    prevState.service === intentResult.service &&
    prevState.area === intentResult.area
  );
}
