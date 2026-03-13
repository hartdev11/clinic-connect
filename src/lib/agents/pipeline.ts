/**
 * Intelligence Layer — Pipeline
 * Flow: User → Intent (A) → Safety (B) → Escalation (E) → Knowledge (C) → Compose (D) → User → Memory (F)
 * 
 * 🧠 CORE PRINCIPLE (หัวใจทั้งระบบ)
 * "บอทห้ามลืมบริบทเดิม เว้นแต่ผู้ใช้เปลี่ยนเรื่องเองอย่างชัดเจน"
 * และ "Intent ใหม่ ≠ Context ใหม่"
 * 
 * 🧱 GLOBAL RULES (ใช้กับทุก intent ทุก agent)
 * RULE 0 — Context First (สำคัญที่สุด)
 * ก่อนตอบ ทุก intent ต้องถามตัวเอง 3 ข้อนี้เสมอ:
 * 1. มี service เดิมใน state ไหม?
 * 2. มี area เดิมใน state ไหม?
 * 3. intent ใหม่นี้ต้องใช้ context เดิมไหม?
 * ถ้า "ต้องใช้" → ห้ามลบ / ห้ามเดาใหม่
 */
import { normalizeLineMessage } from "./normalizer";
import { analyzeIntent, fallbackIntentFromKeywords } from "./intent";
import { checkSafety } from "./safety";
import { checkEscalation } from "./escalation";
import { composeReply } from "./compose";
import { getKnowledge } from "./knowledge";
import { summarizeForCRM } from "./summary";
import { composeSafeFallbackMessage, composeMemoryAnswer } from "./safe-fallback";
import { createInitialState, updateStateFromIntent, isShortFollowUp, isRefinementMessage } from "./conversation-state";
import { finalGuard } from "../guards/final-guard";
import { isRefinementMessage as isRefinementMessageFromGuard } from "../guards/refinement-guard";
import { knowledgeReadyGuard } from "../guards/knowledge-readiness-guard";
import { surgeryFlowGuard } from "../guards/surgery-flow-guard";
import { intentDedupGuard, composeDedupReply } from "../guards/intent-dedup-guard";
import { stateStickinessGuard } from "../guards/state-stickiness-guard";
import { isPreferenceResponse } from "../guards/preference-response-guard";
import { humanFallbackReply } from "./human-fallback";
import { detectTone } from "../tone/tone-detector";
import { isDuplicateIntent } from "../guards/duplicate-intent-guard";
import { selectTemplate } from "./compose-templates";
import { getSessionState, saveSessionState, clearSession } from "./session-storage";
import type { IntentResult } from "./types";
import type { ConversationState } from "./conversation-state";

/** ดักคำถามเรื่องความจำก่อนเรียก Gemini — ไม่เสีย quota */
const MEMORY_INQUIRY_PATTERN = /จำได้ไหม|คุยอะไรกัน|ที่คุยไป|ก่อนหน้านี้/;

const REFER_DOCTOR_MESSAGE =
  "เรื่องนี้แนะนำให้ปรึกษาหมอที่คลินิกโดยตรงจะดีกว่าค่ะ จะได้ดูผิวและแนะนำให้ตรงจุด ถ้าสนใจโทรนัดหรือแวะมาได้เลยนะคะ 😊";

const HANDOFF_MESSAGE =
  "กำลังส่งต่อให้เจ้าหน้าที่ค่ะ รอสักครู่จะมีคนติดต่อกลับนะคะ 😊";

/**
 * รัน pipeline ตาม Enterprise flow
 * ใช้ ConversationState + Template แทนการเดา
 * รองรับ session storage เพื่อเก็บ state ต่อเนื่อง
 */
/** E4, FE-5: options สำหรับ RAG pyramid (org_id, branch_id, role, subscription plan) */
export interface RunPipelineOptions {
  org_id?: string;
  branch_id?: string;
  role?: string; // FE-5 — user role (org-level)
  subscriptionPlan?: string; // FE-5 — subscription plan (starter, professional, multi_branch, enterprise)
  /** Channel (line, web) — สำหรับ booking intent ให้รู้ว่าส่งจาก LINE หรือ web */
  channel?: "line" | "web" | null;
}

export async function runPipeline(
  userText: string,
  userId?: string,
  previousState?: ConversationState,
  pipelineOptions?: RunPipelineOptions
): Promise<{
  reply: string;
  intent?: IntentResult | null;
  state?: ConversationState;
  memory?: { interest?: string[]; customer_stage?: string; sentiment?: string; follow_up_needed?: boolean } | null;
  /** Enterprise: รูปโปรโมชั่น (public HTTPS เท่านั้น) — ส่งแชท LINE เมื่อ promotion_inquiry */
  media?: string[];
  /** Phase 7: เมื่อ escalation → webhook สร้าง handoff_session */
  handoffTriggered?: { triggerType: string; target?: string };
  /** Phase 11 — AI blocked when quota exceeded */
  blocked?: boolean;
}> {
  const orgId = pipelineOptions?.org_id ?? "";
  const channel = pipelineOptions?.channel ?? "default";

  // Presentation: normalize
  const normalized = normalizeLineMessage(userText);
  const text = normalized.message.trim();
  
  // Phase 11: AI Blocked — quota exceeded
  if (orgId) {
    const { getSubscriptionByOrgId } = await import("@/lib/clinic-data");
    const sub = await getSubscriptionByOrgId(orgId);
    if (sub?.aiBlocked) {
      return {
        reply: "บริการถูกระงับชั่วคราว กรุณาติดต่อผู้ดูแลระบบ",
        blocked: true,
      };
    }
  }

  // Phase 7: AI Paused — skip pipeline when handoff active
  if (orgId && userId) {
    const { isConversationAiPaused } = await import("@/lib/handoff-data");
    if (await isConversationAiPaused(orgId, userId)) {
      return { reply: "", intent: null, state: previousState };
    }
  }

  // 🔒 GLOBAL OVERRIDE RULES (รันก่อนทุก agent)
  // RULE 1: Empty / meaningless input
  if (text.length < 2) {
    return { 
      reply: "ขอรายละเอียดเพิ่มนิดนึงนะคะ เดี๋ยวแอดมินช่วยแนะนำให้ค่ะ 😊"
    };
  }

  // RULE 2: Greeting override
  // 🧠 CORE PRINCIPLE: "Intent ใหม่ ≠ Context ใหม่"
  // ❌ ห้าม reset state เพราะ greeting อาจเป็น "ทักซ้ำในแชทเดิม"
  const lowerText = text.toLowerCase();
  if (/^สวัสดี|^hello|^hi|^ฮัลโล/.test(lowerText)) {
    // ดึง state เดิม (ถ้ามี) เพื่อเก็บ context
    let greetingState: ConversationState;
    if (userId) {
      const sessionState = await getSessionState(orgId, channel, userId);
      greetingState = sessionState || createInitialState();
    } else {
      greetingState = previousState || createInitialState();
    }
    
    // อัปเดต recentMessages แต่ไม่ reset state
    const updatedGreetingState: ConversationState = {
      ...greetingState,
      recentMessages: [...greetingState.recentMessages.slice(-4), text].slice(-5),
      lastUpdated: Date.now(),
    };
    
    if (userId) {
      saveSessionState(orgId, channel, userId, updatedGreetingState);
    }
    
    return {
      reply: "สวัสดีค่ะ 😊 มีอะไรให้แอดมินช่วยดูหรือแนะนำไหมคะ",
      state: updatedGreetingState,
    };
  }

  // RULE 3: Reset conversation explicitly
  // 🚫 GLOBAL ANTI-BUG RULES: reset ได้ แค่กรณีเดียว
  // user พูดชัดว่า "เปลี่ยนเรื่องนะ" / "ขอถามอีกอย่าง"
  if (/เริ่มใหม่|ถามใหม่|เปลี่ยนเรื่อง|ลืมเมื่อกี้|รีเซ็ต/i.test(text)) {
    if (userId) {
      clearSession(orgId, channel, userId);
    }
    return {
      reply: "ได้เลยค่ะ 😊 งั้นเริ่มใหม่เลยนะคะ สนใจสอบถามเรื่องอะไรดีคะ"
    };
  }

  // Memory Shortcut — คำถาม "จำได้ไหม / คุยอะไรกัน" ไม่ไปถาม Agent A (ไม่เรียก Gemini)
  if (MEMORY_INQUIRY_PATTERN.test(lowerText)) {
    return { reply: composeMemoryAnswer(normalized) };
  }

  // ดึง session ก่อน — ถ้าข้อความก่อนหน้าผู้ใช้พูด "จอง" ข้อความนี้มักเป็น follow-up ข้อมูลจอง
  const priorState = userId ? await getSessionState(orgId, channel, userId) : previousState;
  const lastUserMessage = priorState?.recentMessages?.slice(-1)[0] ?? "";
  const isBookingFollowUp =
    priorState != null && /จอง|booking|นัด|สมัคร|ต้องการนัด/i.test(lastUserMessage);

  // 🎯 Booking Shortcut — รัน processBookingIntent เมื่อ:
  // 1. พูด "จอง" โดยตรง หรือ 2. ข้อความดูเหมือนข้อมูลจอง (ชื่อ+เบอร์+บริการ+วันที่)
  // 3. หรือเป็น follow-up หลังเราเพิ่งถามข้อมูลจอง
  const hasBookingKeyword = /จอง|booking|นัด|สมัคร|ต้องการนัด|อยากจอง|ขอนัด/i.test(text);
  const hasPhoneNumber = /\b0\d{8,9}\b/.test(text.replace(/\s/g, ""));
  const hasProcedureOrDate =
    /โบท็อกซ์|ฟิลเลอร์|เลเซอร์|รีจูรัน|เติม|สัก|ยิง|Botox|filler|ใบหน้า|วันที่\s*\d+|วัน\d+|เวลา\s*\d+|\d+\s*โมง|\d+:\d+/i.test(text);
  const isDirectBookingIntent =
    hasBookingKeyword || isBookingFollowUp || (hasPhoneNumber && hasProcedureOrDate);
  if (isDirectBookingIntent && pipelineOptions?.org_id) {
    const { processBookingIntent } = await import("../ai/booking-intent");
    const channel = pipelineOptions.channel ?? "line";
    const bookingResult = await processBookingIntent(text, pipelineOptions.org_id, {
      branchId: pipelineOptions.branch_id ?? null,
      channel,
      userId: userId ?? null,
    });
    if (bookingResult) {
      const msg =
        bookingResult.action === "created" ||
        bookingResult.action === "reschedule_requested" ||
        bookingResult.action === "cancel_requested"
          ? bookingResult.message
          : bookingResult.action === "ask_clarification" ||
              bookingResult.action === "reschedule_ask" ||
              bookingResult.action === "cancel_confirm_ask"
            ? bookingResult.question
            : null;
      if (msg) {
        if (userId) {
          const bookingState: ConversationState = {
            ...(priorState ?? createInitialState()),
            stage: "booking",
            intent: "booking_request",
            recentMessages: [...(priorState?.recentMessages ?? []).slice(-4), text].slice(-5),
            lastUpdated: Date.now(),
          };
          saveSessionState(orgId, channel, userId, bookingState);
        }
        return { reply: msg, intent: { intent: "booking_request", service: undefined, area: undefined, confidence: 0.9 } };
      }
      if (bookingResult.action === "no_booking") {
        if (userId) {
          const followUpState: ConversationState = {
            ...(priorState ?? createInitialState()),
            stage: "booking",
            intent: "booking_request",
            recentMessages: [...(priorState?.recentMessages ?? []).slice(-4), text].slice(-5),
            lastUpdated: Date.now(),
          };
          saveSessionState(orgId, channel, userId, followUpState);
        }
        return {
          reply:
            "เพื่อจองนัดให้ค่ะ ขอข้อมูล: ชื่อ-นามสกุล, เบอร์โทร, บริการ/หัตถการ, วันที่ และเวลา พิมพ์ครบทีเดียวหรือทีละข้อก็ได้นะคะ 😊",
          intent: { intent: "booking_request", service: undefined, area: undefined, confidence: 0.9 },
        };
      }
    }
  }

  // ดึง state จาก session (ถ้ามี userId) หรือใช้ previousState หรือสร้างใหม่
  let currentState: ConversationState;
  if (userId) {
    const sessionState = await getSessionState(orgId, channel, userId);
    currentState = sessionState || previousState || createInitialState();
  } else {
    currentState = previousState || createInitialState();
  }

  // 🎯 หลังจองแล้ว — ถ้าผู้ใช้ตอบสั้น ๆ (ใบหน้า, ลดริ้วรอย ฯลฯ) = แค่เพิ่มข้อมูล ไม่ต้องเข้าสู่ flow สำรวจบริการใหม่
  if (currentState.stage === "booking" && text.length < 30) {
    const isAreaOrDetail = /ใบหน้า|หน้าผาก|คิ้ว|ริ้วรอย|โบท็อกซ์|ฟิลเลอร์|ลดริ้วรอย|เติมเต็ม/i.test(text);
    if (isAreaOrDetail) {
      const briefReply =
        "จองให้แล้วค่ะ ได้รับข้อมูลเพิ่มเติมไว้แล้ว มีอะไรให้ช่วยเพิ่มไหมคะ 😊";
      return {
        reply: briefReply,
        intent: { intent: "booking_request", service: undefined, area: undefined, confidence: 0.9 },
        state: currentState,
      };
    }
  }

  // ✅ Preference Response Guard (สำคัญมาก - acknowledge คำตอบ preference)
  // ป้องกันการถามซ้ำเมื่อลูกค้าตอบ preference
  // ถ้า user เพิ่งตอบ preference → ต้อง acknowledge + ต่อ flow เดิม
  if (
    isPreferenceResponse(currentState, text) &&
    currentState.service &&
    currentState.area &&
    currentState.area !== "unknown"
  ) {
    const { templateAfterNosePreference } = await import("./compose-templates");
    
    // ✅ เก็บ preference จาก preference response
    const lower = text.toLowerCase();
    let style: string | undefined;
    let intensity: string | undefined;
    
    // Mapping style (สำหรับศัลยกรรมจมูก)
    if (/ธรรมชาติ/.test(lower)) style = "ธรรมชาติ";
    else if (/โด่ง|พุ่ง/.test(lower)) style = "โด่ง";
    else if (/สายเกาหลี|เกาหลี/.test(lower)) style = "สายเกาหลี";
    else if (/สายฝอ/.test(lower)) style = "สายฝอ";
    else if (/คม/.test(lower)) style = "คม";
    else if (/หวาน/.test(lower)) style = "หวาน";
    else if (/ละมุน/.test(lower)) style = "ละมุน";
    
    // Mapping intensity (ถ้ามี style แล้ว)
    if (currentState.preference?.style || style) {
      if (/ไม่เวอร์|ไม่เอาเวอร์|เบา|นุ่ม/.test(lower)) intensity = "เบา";
      else if (/ชัด|เด่น|ชัดเจน/.test(lower)) intensity = "ชัด";
      else if (/กลาง|พอดี/.test(lower)) intensity = "กลาง";
    }
    
    // Acknowledge + ถามต่อ (ไม่ถามซ้ำ)
    const reply = templateAfterNosePreference({
      ...currentState,
      preference: {
        ...currentState.preference,
        ...(style && { style }),
        ...(intensity && { intensity }),
      },
    });
    
    // อัปเดต preference และ recentMessages แต่ไม่เปลี่ยน service/area/stage
    const preferenceResponseState: ConversationState = {
      ...currentState,
      preference: {
        ...currentState.preference,
        ...(style && { style }),
        ...(intensity && { intensity }),
      },
      recentMessages: [...currentState.recentMessages.slice(-4), text].slice(-5),
      lastUpdated: Date.now(),
    };
    
    if (userId) {
      saveSessionState(orgId, channel, userId, preferenceResponseState);
    }
    
    if (process.env.NODE_ENV === "development") {
      console.log("[Pipeline] Preference response detected - acknowledging and continuing flow");
    }
    
    return {
      reply,
      intent: { intent: currentState.intent || "promotion_inquiry", confidence: 0.9 },
      state: preferenceResponseState,
    };
  }
  
  // 🔧 2️⃣ Refinement Guard: แก้ปัญหา "โด่งๆ แล้วระบบพัง"
  // ❗ ไม่ต้อง analyze intent ใหม่
  // ❗ ไม่ overwrite service / area
  // ❗ แต่คือ REFINEMENT ของ service เดิม
  // ✅ Human First Rule: เก็บ preference จาก refinement message
  if (
    isRefinementMessageFromGuard(text) &&
    currentState.service &&
    currentState.area &&
    currentState.area !== "unknown"
  ) {
    const { templateRefinement, templateHesitation } = await import("./compose-templates");
    
    // ✅ เก็บ preference จาก refinement message (ตามโครงสร้าง PreferenceState)
    const lower = text.toLowerCase();
    let style: string | undefined;
    let concern: string | undefined;
    let intensity: string | undefined;
    
    // Mapping style (สำหรับศัลยกรรมจมูก)
    if (/โด่ง|พุ่ง/.test(lower)) style = "โด่ง";
    else if (/ธรรมชาติ/.test(lower)) style = "ธรรมชาติ";
    else if (/สายเกาหลี/.test(lower)) style = "สายเกาหลี";
    else if (/สายฝอ/.test(lower)) style = "สายฝอ";
    else if (/คม/.test(lower)) style = "คม";
    else if (/หวาน/.test(lower)) style = "หวาน";
    else if (/ละมุน/.test(lower)) style = "ละมุน";
    
    // Mapping concern (ปัญหาที่กังวล) — เมื่อลูกค้าแจ้ง concern (กลัวเจ็บ, กังวล ฯลฯ)
    // → ใช้ templateHesitation แทน templateRefinement เพื่อตอบตรงบริบท
    if (/กลัว|กังวล|เจ็บ/.test(lower)) {
      concern = lower.match(/(กลัว|กังวล|เจ็บ)[^\s]*/)?.[0] || "กังวล";
    }
    
    // Mapping intensity (ความชัด / ไม่เวอร์)
    if (/ไม่เวอร์|ไม่เอาเวอร์|เบา|นุ่ม/.test(lower)) intensity = "เบา";
    else if (/ชัด|เด่น|ชัดเจน/.test(lower)) intensity = "ชัด";
    else if (/กลาง|พอดี/.test(lower)) intensity = "กลาง";
    
    // ถ้าเป็น concern (กลัว/กังวล) → ใช้ templateHesitation ตอบตรงบริบท
    const reply = concern
      ? templateHesitation(currentState, normalized.message)
      : templateRefinement(currentState, normalized.message);
    
    // อัปเดต recentMessages และ preference แต่ไม่เปลี่ยน service/area/stage
    const refinementState: ConversationState = {
      ...currentState,
      preference: {
        ...currentState.preference,
        ...(style && { style }),
        ...(concern && { concern }),
        ...(intensity && { intensity }),
      },
      recentMessages: [...currentState.recentMessages.slice(-4), text].slice(-5),
      lastUpdated: Date.now(),
    };
    
    if (userId) {
      saveSessionState(orgId, channel, userId, refinementState);
    }
    
    return {
      reply,
      intent: { intent: currentState.intent || "general_chat", confidence: 0.9 },
      state: refinementState,
    };
  }
  
  // Agent A: Intent & Context (ห้าม return null)
  let intentResult = await analyzeIntent(normalized);
  
  // ✅ Duplicate Intent Guard (ตัวเล็ก แต่โคตรสำคัญ)
  // ป้องกันการถามซ้ำเมื่อลูกค้าพูดซ้ำ intent เดิม
  // ถ้า intent + service + area เหมือนเดิม → ห้ามถามซ้ำ
  if (isDuplicateIntent(currentState, intentResult)) {
    // ซ้ำ → ตอบสั้น / acknowledge อย่างเดียว
    const duplicateReply = `ได้เลยค่ะ 😊`;
    
    // อัปเดต recentMessages แต่ไม่เปลี่ยน state อื่น ๆ
    const duplicateState: ConversationState = {
      ...currentState,
      recentMessages: [...currentState.recentMessages.slice(-4), normalized.message].slice(-5),
      lastUpdated: Date.now(),
    };
    
    if (userId) {
      saveSessionState(orgId, channel, userId, duplicateState);
    }
    
    if (process.env.NODE_ENV === "development") {
      console.log("[Pipeline] Duplicate intent detected - skipping duplicate question");
    }
    
    return {
      reply: duplicateReply,
      intent: intentResult,
      state: duplicateState,
    };
  }
  
  // ✅ Tone Detection (สำคัญมาก - กำหนดระดับคำตอบตามพฤติกรรมลูกค้า)
  // tone เปลี่ยนตาม "รอบสนทนา" ไม่ fixed
  const tone = detectTone(normalized.message);
  
  // 🧱 RULE 0 — Context First (สำคัญที่สุด)
  // ก่อนตอบ ทุก intent ต้องถามตัวเอง 3 ข้อนี้เสมอ:
  // 1. มี service เดิมใน state ไหม?
  // 2. มี area เดิมใน state ไหม?
  // 3. intent ใหม่นี้ต้องใช้ context เดิมไหม?
  // ถ้า "ต้องใช้" → ห้ามลบ / ห้ามเดาใหม่
  
  // 🔥 FIX: Carry forward service/area จาก state เดิม (สำคัญมาก)
  // หลัง detect intent ทุกครั้ง → ถ้า intent ใหม่ไม่ระบุ service/area
  // ให้ใช้ของเดิมจาก state เสมอ
  // 
  // 📌 สำคัญมาก: price_inquiry, promotion_inquiry, availability_check
  // 👉 3 intent นี้ ห้าม reset service / area เด็ดขาด
  if (
    !intentResult.service &&
    currentState.service
  ) {
    intentResult = {
      ...intentResult,
      service: currentState.service,
      area: currentState.area || intentResult.area,
    };
    
    if (process.env.NODE_ENV === "development") {
      console.log("[Pipeline] Carrying forward service/area from state:", {
        intent: intentResult.intent,
        service: intentResult.service,
        area: intentResult.area,
      });
    }
  }
  
  // ⚠️ Context-aware: Intent ใหม่แต่ service/area ไม่มา → ใช้ของเดิมจาก state เสมอ
  // 3️⃣ promotion_inquiry / price_inquiry — กติกาทอง (เสริมความแน่นอน)
  // ✅ ใช้ service จาก state ถ้า intentResult ไม่มี
  // ❌ ห้าม set service = other
  // ❌ ห้ามเดา area
  if (
    intentResult.intent === "price_inquiry" &&
    !intentResult.service &&
    currentState.service
  ) {
    intentResult = {
      ...intentResult,
      service: currentState.service,
      area: currentState.area || intentResult.area,
    };
  }
  
  // ⚠️ Promotion inquiry context-aware (สำคัญมาก - แก้ปัญหา "มีโปรอะไรบ้าง")
  if (
    intentResult.intent === "promotion_inquiry" &&
    !intentResult.service &&
    currentState.service
  ) {
    intentResult = {
      ...intentResult,
      service: currentState.service,
      area: currentState.area || intentResult.area,
    };
  }
  
  // 4️⃣ availability_check — 🔥 อันนี้ต้องจำให้ขึ้นใจ
  // RULE สำคัญ: availability_check = ใช้ context เดิม 100%
  // ❌ templatePricing (ห้ามเด็ดขาด)
  // ❌ แสดงราคา
  // ✅ templateAvailability เท่านั้น
  if (
    intentResult.intent === "availability_check" &&
    !intentResult.service &&
    currentState.service
  ) {
    intentResult = {
      ...intentResult,
      service: currentState.service,
      area: currentState.area || intentResult.area,
    };
  }
  
  // ✅ FIX: อัปเดต state จาก intent ก่อน selectTemplate
  // 🔧 แก้ลำดับ: updateStateFromIntent() ต้องเกิดก่อน selectTemplate()
  // เพื่อให้ state มี service/area ที่ถูกต้องก่อนเลือก template
  // 
  // ⚠️ สำคัญ: updateStateFromIntent() จะอัปเดต service เฉพาะเมื่อ intentResult.service มีค่า
  // ดังนั้นต้องแน่ใจว่า intentResult มี service ก่อนเรียก updateStateFromIntent()
  
  // ✅ Human First Rule: Detect preference จาก user message โดยตรง
  // ถ้าลูกค้าตอบ style โดยตรง (เช่น "ธรรมชาติ", "โด่ง", "สายเกาหลี")
  // ให้เก็บ preference ก่อน updateStateFromIntent()
  const lower = normalized.message.toLowerCase();
  let detectedStyle: string | undefined;
  let detectedIntensity: string | undefined;
  
  // Detect style สำหรับศัลยกรรมจมูก
  if (currentState.service === "surgery" && currentState.area === "nose") {
    if (/ธรรมชาติ/.test(lower)) detectedStyle = "ธรรมชาติ";
    else if (/โด่ง|พุ่ง/.test(lower)) detectedStyle = "โด่ง";
    else if (/สายเกาหลี/.test(lower)) detectedStyle = "สายเกาหลี";
    else if (/สายฝอ/.test(lower)) detectedStyle = "สายฝอ";
    
    // Detect intensity
    if (/ไม่เวอร์|ไม่เอาเวอร์|เบา|นุ่ม/.test(lower)) detectedIntensity = "เบา";
    else if (/ชัด|เด่น|ชัดเจน/.test(lower)) detectedIntensity = "ชัด";
    else if (/กลาง|พอดี/.test(lower)) detectedIntensity = "กลาง";
  }
  
  // ถ้า detect preference ได้ → อัปเดต currentState ก่อน updateStateFromIntent()
  if (detectedStyle || detectedIntensity) {
    currentState = {
      ...currentState,
      preference: {
        ...currentState.preference,
        ...(detectedStyle && { style: detectedStyle }),
        ...(detectedIntensity && { intensity: detectedIntensity }),
      },
    };
  }
  
  // ✅ STATE STICKINESS GUARD (สำคัญมาก)
  // ป้องกัน state หาย/reset เมื่อพิมพ์สั้น ๆ ซ้ำความหมายเดิม
  // ถ้า ข้อความใหม่ไม่ได้เพิ่มข้อมูลใหม่ → ❌ ห้าม reset state
  if (stateStickinessGuard(currentState, intentResult)) {
    // State stick - ห้าม reset, ห้ามถามคำถามใหม่
    // แค่ตอบรับสั้น ๆ เหมือนคนจริง
    const stickReply = humanFallbackReply(currentState);
    
    // อัปเดต recentMessages แต่ไม่เปลี่ยน state อื่น ๆ
    const stickState: ConversationState = {
      ...currentState,
      recentMessages: [...currentState.recentMessages.slice(-4), normalized.message].slice(-5),
      lastUpdated: Date.now(),
    };
    
    if (userId) {
      saveSessionState(orgId, channel, userId, stickState);
    }
    
    if (process.env.NODE_ENV === "development") {
      console.log("[Pipeline] State stickiness detected - using human fallback");
    }
    
    return {
      reply: stickReply,
      intent: intentResult,
      state: stickState,
    };
  }
  
  let updatedState = updateStateFromIntent(currentState, intentResult, normalized.message);
  
  // ✅ อัปเดต tone ใน state (สำคัญมาก - ใช้กำหนดระดับคำตอบ)
  updatedState = {
    ...updatedState,
    tone, // อัปเดต tone ทุกข้อความ
  };
  
  // ✅ FIX: ถ้า intentResult มี service แต่ updatedState ยังไม่มี → อัปเดต state อีกครั้ง
  // เพื่อให้แน่ใจว่า state มี service ก่อน selectTemplate
  // (กรณีที่ updateStateFromIntent() ไม่ได้อัปเดต service เนื่องจาก logic อื่น)
  if (intentResult.service && !updatedState.service) {
    // อัปเดต state อีกครั้งด้วย service จาก intentResult
    updatedState = updateStateFromIntent(currentState, {
      ...intentResult,
      service: intentResult.service,
      area: intentResult.area || updatedState.area,
    }, normalized.message);
  }
  
  // Debug: ตรวจสอบว่า state ถูกอัปเดตหรือไม่
  if (process.env.NODE_ENV === "development" && intentResult.service) {
    console.log("[Pipeline] IntentResult:", {
      intent: intentResult.intent,
      service: intentResult.service,
      area: intentResult.area,
    });
    console.log("[Pipeline] UpdatedState:", {
      service: updatedState.service,
      area: updatedState.area,
      stage: updatedState.stage,
    });
  }
  
  // 🔑 Intent Deduplication Guard (โคตรสำคัญ)
  // ป้องกันการถามซ้ำเมื่อลูกค้าพิมพ์ข้อความที่ความหมายเหมือนเดิม
  // กฎเหล็ก: ❌ ข้อความใหม่ ≠ state ใหม่เสมอ
  // ✅ ถ้าความหมายเท่าเดิม → ห้าม reset flow
  if (intentDedupGuard(currentState, intentResult.intent, updatedState)) {
    // ข้อความซ้ำความหมายเดิม → ไม่ถามซ้ำ แต่ตอบรับสั้น ๆ
    const dedupReply = composeDedupReply(updatedState);
    
    // อัปเดต recentMessages แต่ไม่เปลี่ยน state อื่น ๆ
    const dedupState: ConversationState = {
      ...updatedState,
      recentMessages: [...updatedState.recentMessages.slice(-4), normalized.message].slice(-5),
      lastUpdated: Date.now(),
    };
    
    if (userId) {
      saveSessionState(orgId, channel, userId, dedupState);
    }
    
    if (process.env.NODE_ENV === "development") {
      console.log("[Pipeline] Intent deduplication detected - skipping duplicate question");
    }
    
    return {
      reply: dedupReply,
      intent: intentResult,
      state: dedupState,
    };
  }
  
  // 🔒 อย่างที่ 1: Knowledge Readiness Guard (ขั้นสุดท้ายจริง ๆ)
  // กัน AI อธิบายแทนถ้า knowledge ยังว่าง
  // AI ไม่ improvise, ดูซื่อ / มืออาชีพ, ลูกค้าไม่รู้สึกว่า AI มั่ว
  const knowledgeReply = knowledgeReadyGuard(updatedState);
  if (knowledgeReply) {
    // บันทึก state ลง session (ถ้ามี userId)
    if (userId) {
      saveSessionState(orgId, channel, userId, updatedState);
    }
    return {
      reply: knowledgeReply,
      intent: intentResult,
      state: updatedState,
    };
  }
  
  // 🔒 อย่างที่ 2: Surgery Flow Lock (กันศัลยกรรมหลุดไป pricing/โปรเร็ว)
  // ศัลยกรรม → ห้ามราคา จนกว่าจะ consult
  // skin → ราคาเป็นช่วงได้
  const surgeryReply = surgeryFlowGuard(updatedState, intentResult.intent);
  if (surgeryReply) {
    // บันทึก state ลง session (ถ้ามี userId)
    if (userId) {
      saveSessionState(orgId, channel, userId, updatedState);
    }
    return {
      reply: surgeryReply,
      intent: intentResult,
      state: updatedState,
    };
  }
  
  // เช็คว่าเป็น short follow-up หรือไม่ (เช่น "รีจูรันครับ")
  const isFollowUp = isShortFollowUp(normalized.message, currentState);

  // Agent B: Policy & Safety (rule-based)
  const safety = checkSafety(intentResult.intent);
  if (!safety.allowed && safety.action === "refer_to_doctor") {
    return { 
      reply: REFER_DOCTOR_MESSAGE, 
      intent: intentResult,
      state: updatedState 
    };
  }

  // Agent E: Escalation — Enterprise multi-signal confidence + rate limit
  const escalation = checkEscalation(intentResult.intent, text);
  const historyAsMessages = updatedState.recentMessages.map((c) => ({ content: c, role: "user" as const }));
  const confidence = (await import("@/lib/ai/handoff-confidence")).calculateHandoffConfidence(text, historyAsMessages);
  const shouldHandoffByConfidence = (await import("@/lib/ai/handoff-confidence")).shouldTriggerHandoff(confidence);
  const shouldHandoff = escalation.handoff || shouldHandoffByConfidence;

  if (shouldHandoff) {
    const customerId = userId ?? `anon_${orgId}`;
    const rateLimit = await import("@/lib/ai/handoff-rate-limit").then((m) =>
      m.checkHandoffRateLimit(customerId)
    );
    if (!rateLimit.allowed) {
      if (process.env.NODE_ENV === "development") {
        console.log("[Agent E] Handoff blocked by rate limit:", rateLimit.reason);
      }
    } else {
      if (process.env.NODE_ENV === "development") {
        console.log("[Agent E Escalation] handoff:", escalation.handoff ? "intent" : "confidence", "triggerType:", confidence.triggerType ?? escalation.triggerType);
      }
      const handoffState: ConversationState = {
        ...updatedState,
        stage: "waiting_admin",
      };
      if (userId) {
        saveSessionState(orgId, channel, userId, handoffState);
      }
      const triggerType = shouldHandoffByConfidence ? confidence.triggerType : (escalation.triggerType ?? "angry_customer");
      const target = triggerType === "medical" || triggerType === "complex_medical" ? "doctor" : "admin";
      return {
        reply: HANDOFF_MESSAGE,
        intent: intentResult,
        state: handoffState,
        handoffTriggered: { triggerType, target },
      };
    }
  }

  // ⚠️ ถ้า state เป็น waiting_admin → bot หยุดพูด (ไม่ตอบ)
  if (currentState.stage === "waiting_admin") {
    return {
      reply: "", // ไม่ตอบ
      intent: intentResult,
      state: currentState,
    };
  }

  // 5️⃣ booking_request
  // กติกา:
  // ถ้ายังไม่มี service → ถาม service
  // ถ้ามี service แต่ไม่มีวัน → ขอวัน
  // ถ้ามีครบ → confirm
  // ⚠️ Booking Readiness Check
  // ถ้าลูกค้าขอจองแต่ยังไม่มี service หรือ area → block
  if (intentResult.intent === "booking_request" && (!updatedState.service || !updatedState.area)) {
    const { templateBookingNotReady } = await import("./compose-templates");
    const reply = templateBookingNotReady(updatedState);
    return {
      reply,
      intent: intentResult,
      state: updatedState,
    };
  }

  // Enterprise: promotion_inquiry — ดึงโปรที่เกี่ยวข้อง + รูปส่งแชท
  if (intentResult.intent === "promotion_inquiry" && orgId) {
    try {
      const { getActivePromotionsForAI, getPromotions } = await import("@/lib/clinic-data");
      const { searchPromotionsBySemantic } = await import("@/lib/promotion-embedding");
      const branchId = pipelineOptions?.branch_id ?? undefined;
      const query = text.trim().length >= 2 ? text.trim() : "";
      let list: Array<{ promotion: import("@/types/clinic").Promotion; score?: number }>;
      if (query.length >= 2) {
        const hits = await searchPromotionsBySemantic(orgId, query, { branchId, topK: 5 });
        list = hits.map((h) => ({ promotion: h.promotion, score: h.score }));
        if (list.length === 0) {
          const fallback = await getActivePromotionsForAI(orgId, { branchId, limit: 5 });
          list = fallback.map((p) => ({ promotion: p }));
        }
      } else {
        const fallback = await getActivePromotionsForAI(orgId, { branchId, limit: 5 });
        list = fallback.map((p) => ({ promotion: p }));
      }
      if (process.env.NODE_ENV === "development") {
        console.log("[Pipeline promotion_inquiry] orgId=%s listLength=%d", orgId, list.length);
      }
      const mediaUrls: string[] = [];
      if (list.length === 0) {
        // Enterprise: ข้อความชัดเจน — แยกกรณีไม่มีโปรเลย vs มีแต่ยังไม่เปิดใช้
        let emptyReply: string;
        try {
          const anyPromos = await getPromotions(orgId, { status: "all", limit: 5 });
          if (anyPromos.length > 0) {
            emptyReply =
              "ตอนนี้ยังไม่มีโปรที่เปิดใช้อยู่ค่ะ ลองไปที่เมนูโปรโมชันแล้วกดเปิดใช้ (สถานะ 'เปิดใช้') ให้โปรที่ต้องการแสดงนะคะ หรือโทรมาถามได้เลยค่ะ 😊";
            if (process.env.NODE_ENV === "development") {
              console.log("[Pipeline promotion_inquiry] org has promotions but none active/suitable — statuses:", anyPromos.map((p) => p.status));
            }
          } else {
            emptyReply = "ตอนนี้ยังไม่มีโปรโมชันในระบบค่ะ เดี๋ยวแอดมินเช็กให้หรือโทรมาถามได้เลยนะคะ 😊";
            if (process.env.NODE_ENV === "development") {
              console.log("[Pipeline promotion_inquiry] org has no promotions — check LINE_ORG_ID matches the org in app");
            }
          }
        } catch {
          emptyReply = "ตอนนี้ยังไม่มีโปรที่เหมาะกับที่ถามค่ะ เดี๋ยวแอดมินเช็กให้หรือโทรมาถามได้เลยนะคะ 😊";
        }
        if (userId) saveSessionState(orgId, channel, userId, updatedState);
        return {
          reply: emptyReply,
          intent: intentResult,
          state: updatedState,
          memory: null,
        };
      }
      const lines: string[] = [];
      for (const { promotion: p } of list.slice(0, 4)) {
        const pricePart = p.extractedPrice != null ? ` — ฿${Number(p.extractedPrice).toLocaleString()}` : "";
        lines.push(`• ${p.name}${pricePart}`);
        const firstImage = p.media?.find((m) => m.type === "image" && typeof m.url === "string" && m.url.startsWith("https://"));
        if (firstImage?.url) mediaUrls.push(firstImage.url);
      }
      const reply = "มีโปรแบบนี้ค่ะ\n\n" + lines.join("\n") + "\n\nสนใจโปรไหนบอกได้เลยนะคะ 💕";
      if (userId) saveSessionState(orgId, channel, userId, updatedState);
      return {
        reply,
        intent: intentResult,
        state: updatedState,
        memory: null,
        media: mediaUrls.length > 0 ? mediaUrls.slice(0, 4) : undefined,
      };
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Pipeline promotion_inquiry] error:", (err as Error)?.message?.slice(0, 60));
      }
    }
  }

  // 🔧 Fallback rule (กันตอบมั่วขั้นสุด)
  // ถ้า intent ไม่ชัด (other หรือ general_chat ที่ไม่มีความหมาย) → ถามกลับ 1 คำถามสุภาพ
  // ห้ามสรุปเอง — นี่คือ airbag เวลาลูกค้าพิมพ์กำกวมมากๆ
  if (
    (updatedState.intent === "other" || 
     (updatedState.intent === "general_chat" && !updatedState.service && text.length < 10)) &&
    !isFollowUp
  ) {
    return {
      reply: "ได้เลยค่ะ 😊 สนใจสอบถามเรื่องอะไรเป็นพิเศษคะ เดี๋ยวช่วยแนะนำให้ค่ะ 💕",
      intent: intentResult,
      state: updatedState,
    };
  }

  // กติกา "ห้ามเดา" — ถ้า service ยังไม่ชัด → ใช้ template exploring
  // ✅ FIX: เช็ค updatedState.service หลังจากอัปเดตแล้ว
  if (!updatedState.service && 
      updatedState.intent !== "general_chat" && 
      updatedState.intent !== "greeting" &&
      updatedState.intent !== "conversation_memory_check" &&
      updatedState.intent !== "comparison_inquiry" && // 🔧 comparison_inquiry อาจไม่มี service
      updatedState.intent !== "hesitation") { // 🔧 hesitation อาจไม่มี service
    const reply = selectTemplate(updatedState, normalized.message, isFollowUp);
    return { 
      reply, 
      intent: intentResult,
      state: updatedState 
    };
  }

  // Agent D: Conversation Composer — ใช้ Template แทน AI (หรือใช้ AI เมื่อจำเป็น)
  // 🧠 FINAL FLOW (สั้นมาก แต่ใช้ได้ทุกเคส):
  // 1. Load state ✅
  // 2. Analyze intent ✅
  // 3. Merge intentResult + state (Context Carry) ✅
  // 4. Update stage (ไม่ลบของเดิม) ✅
  // 5. Select template ตาม intent (ไม่มั่ว) ← ตรงนี้
  // 6. Guard ซ้ำ (service/area หายไหม?) ← template จะ guard เอง
  // 7. Reply ← ตรงนี้
  // 8. Save state ✅
  // 
  // 5️⃣ Template-only Replies (ลด AI เอ๋อ 90%)
  // ใช้ Template เป็นหลัก
  // AI ใช้แค่กรณี: medical explanation, soft wording, fallback เท่านั้น
  let reply: string;
  
  // selectTemplate จะเลือก template ที่ถูกต้องตาม intent และ stage
  // - service_information → templateServiceInformation (ห้ามขาย, ห้ามราคา)
  // - availability_check → templateAvailability (ห้ามแสดงราคา)
  // - pricing → templatePricing (มี guard ว่าต้องมี service)
  // - medical → templateMedical
  // - short follow-up → templateShortFollowUp
  reply = selectTemplate(updatedState, normalized.message, isFollowUp);
  
  // Fallback: ถ้า template ไม่ได้ reply (ไม่ควรเกิด) → ใช้ Human Fallback หรือ AI
    if (!reply || reply.trim().length === 0) {
      // ✅ Human Fallback (สำคัญมาก - ทำให้ไม่ดูเป็น AI)
      // ถ้าไม่มีคำถามใหม่, ไม่ได้ขอข้อมูล, แค่ตอบรับ/ยืนยัน
      // → ต้องตอบสั้นมาก เหมือนแอดมินพิมพ์เอง
      reply = humanFallbackReply(updatedState);
      
      // ถ้า human fallback ก็ว่าง → ใช้ AI (E4: RAG context)
      if (!reply || reply.trim().length === 0) {
        const knowledge = await getKnowledge(
          intentResult.intent,
          intentResult.service ?? updatedState.service,
          intentResult.area ?? updatedState.area,
          {
            userMessage: normalized.message,
            org_id: pipelineOptions?.org_id,
            branch_id: pipelineOptions?.branch_id ?? updatedState.branchId,
          }
        );
        const replyText = await composeReply(
          intentResult,
          knowledge,
          normalized.message
        );
        reply = replyText?.trim() || humanFallbackReply(updatedState);
      }
    }

  // ✅ 1️⃣ Final Guard: ป้องกันการ "ข้ามขั้น / ตอบผิดบริบท"
  // ใช้ return enum แทน throw Error เพื่อให้รู้ว่า fail เพราะอะไร
  // ระบบไม่ crash, UX ไม่กระตุก
  const guardResult = finalGuard(updatedState, reply);
  
  if (!guardResult.ok) {
    // ถ้า guard พบปัญหา → ใช้ template ที่เหมาะสมตาม reason
    console.warn("[Final Guard] Blocked illegal reply:", guardResult.reason);
    
    switch (guardResult.reason) {
      case "ILLEGAL_TEXT":
      case "STAGE_MISMATCH":
        // ใช้ templateExploring (ปลอดภัยที่สุด)
        const { templateExploring } = await import("./compose-templates");
        reply = templateExploring(updatedState);
        break;
      case "PRICE_WITHOUT_SERVICE":
      case "PRICE_WITHOUT_AREA":
        // ถ้ายังไม่มี service/area → ใช้ templateExploring
        if (!updatedState.service) {
          const { templateExploring } = await import("./compose-templates");
          reply = templateExploring(updatedState);
        } else if (!updatedState.area) {
          const { templateServiceSelected } = await import("./compose-templates");
          reply = templateServiceSelected(updatedState);
        } else {
          // ถ้ามีครบแล้วแต่ guard fail → ใช้ templateExploring
          const { templateExploring } = await import("./compose-templates");
          reply = templateExploring(updatedState);
        }
        break;
      case "ASK_AREA_AGAIN":
        // ถ้ามี area แล้วแต่ถามซ้ำ → ใช้ templatePricing
        if (updatedState.service && updatedState.area) {
          const { templatePricing } = await import("./compose-templates");
          reply = templatePricing(updatedState);
        } else {
          const { templateExploring } = await import("./compose-templates");
          reply = templateExploring(updatedState);
        }
        break;
      default:
        // Fallback: ใช้ templateExploring
        const { templateExploring: fallbackTemplate } = await import("./compose-templates");
        reply = fallbackTemplate(updatedState);
    }
    
    // ตรวจสอบ guard อีกครั้ง (กัน infinite loop)
    const retryGuard = finalGuard(updatedState, reply);
    if (!retryGuard.ok) {
      // ถ้ายังไม่ผ่าน → ใช้ templateExploring (ปลอดภัยที่สุด)
      const { templateExploring: safeTemplate } = await import("./compose-templates");
      reply = safeTemplate(updatedState);
    } else {
      reply = retryGuard.text;
    }
  } else {
    reply = guardResult.text;
  }

  // Agent F: Memory / CRM — fire-and-forget (ไม่กระทบ reply)
  // เรียกเฉพาะเมื่อลูกค้าสนใจโปรหรือขอจอง
  // Error แล้ว log อย่างเดียว ห้ามกระทบ reply ลูกค้า
  const shouldRunMemory =
    intentResult.intent === "booking_request" ||
    intentResult.intent === "promotion_inquiry";
  let memory: { interest?: string[]; customer_stage?: string; sentiment?: string; follow_up_needed?: boolean } | null = null;
  if (shouldRunMemory) {
    // void = fire-and-forget, ไม่ await, ไม่ block reply
    void summarizeForCRM(normalized.message, reply).then((m) => {
      if (m) {
        memory = m;
        if (process.env.NODE_ENV === "development") {
          console.log("[Agent F Memory]", m);
        }
      }
    }).catch((err) => {
      // Error handling: log เฉพาะ dev, ไม่ส่งถึงลูกค้า
      if (process.env.NODE_ENV === "development") {
        console.warn("[Agent F Memory] Error (non-blocking):", (err as Error)?.message?.slice(0, 60));
      }
    });
  }

  // บันทึก state ลง session (ถ้ามี userId)
  if (userId) {
    saveSessionState(orgId, channel, userId, updatedState);
  }

  return { 
    reply, 
    intent: intentResult, 
    state: updatedState,
    memory 
  };
}
