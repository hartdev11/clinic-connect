/**
 * Conversation State — หัวใจของความฉลาด
 * ถ้าไม่มีอันนี้ = AI จะ "ฉลาดเป็นครั้ง ๆ"
 * ถ้ามีอันนี้ = AI จะ "คุยเป็นเรื่องเดียวกัน"
 * 
 * 🧠 CORE PRINCIPLE: "บอทห้ามลืมบริบทเดิม เว้นแต่ผู้ใช้เปลี่ยนเรื่องเองอย่างชัดเจน"
 * 🚫 GLOBAL ANTI-BUG RULES:
 * - ❌ ห้าม reset state เพราะ intent ใหม่ (intent เปลี่ยน ≠ เรื่องเปลี่ยน)
 * - ❌ ห้าม set service = other ถ้าเคยมี service มาก่อน
 */
import type { ServiceCategory, ServiceType, Area, IntentType } from "./types";
import { hasFixedArea } from "./types";

export type ConversationStage =
  | "greeting"
  | "exploring"        // ยังดูๆ ว่าทำอะไรได้บ้าง
  | "service_selected" // เลือกบริการแล้ว
  | "area_selected"    // เลือกบริเวณแล้ว
  | "pricing"          // คุยเรื่องราคา/โปร
  | "booking"          // พร้อมจอง
  | "postcare"         // หลังทำ
  | "medical"
  | "handoff"
  | "waiting_admin";   // ส่งต่อคนแล้ว — bot หยุดพูด

/**
 * Tone Level — ระดับคำตอบตามพฤติกรรมลูกค้า
 * 
 * ระดับคำตอบ ไม่ได้ขึ้นกับ service แต่ขึ้นกับ พฤติกรรมลูกค้า
 * - short: พิมพ์สั้น / ตอบสั้น → ตอบสั้น
 * - medium: สนใจระดับหนึ่ง → อธิบายได้ 1 ประโยค
 * - explain: อยากรู้จริง → อธิบายได้ แต่ยังห้ามวิชาการ
 */
export type ToneLevel = "short" | "medium" | "explain";

/**
 * ✅ Preference State — ข้อมูลความต้องการเชิงความรู้สึก / สไตล์
 * ที่ลูกค้าต้องบอกก่อน AI ห้ามอธิบายเชิงวิชาการ ถ้ายังไม่มีสิ่งนี้
 * 
 * 📌 ยังว่าง = ห้ามให้ข้อมูลยาว
 * 📌 มีบางช่อง = ค่อยอธิบายบางส่วน
 */
export interface PreferenceState {
  style?: string;        // ธรรมชาติ / โด่ง / เกาหลี / ละมุน
  concern?: string;       // กลัวอะไร / กังวลอะไร / ปัญหาเดิม
  intensity?: string;    // เบา / กลาง / ชัด / ไม่เวอร์
  goal?: string;         // อยากได้ผลลัพธ์แบบไหน
}

export interface ConversationState {
  branchId?: string;
  serviceCategory?: ServiceCategory;
  service?: ServiceType | ServiceCategory;
  area?: Area;
  intent?: IntentType;
  stage: ConversationStage;

  missing: {
    service?: boolean;
    area?: boolean;
    date?: boolean;
  };

  // ✅ Preference State — หัวใจของ Human First Rule
  // ถ้ายังไม่มี preference → หน้าที่ AI = ถามอย่างเดียว
  preference?: PreferenceState;

  // ✅ Tone Level — ระดับคำตอบตามพฤติกรรมลูกค้า
  // default = short (ถ้าไม่รู้ → ตอบสั้นไว้ก่อนเสมอ)
  tone?: ToneLevel;

  recentMessages: string[]; // เก็บข้อความล่าสุด 3-5 ข้อความ
  lastUpdated: number;
}

/**
 * สร้าง state เริ่มต้น
 */
export function createInitialState(): ConversationState {
  return {
    stage: "greeting",
    missing: {},
    preference: {}, // ✅ Preference State เริ่มต้น (ว่าง = ห้ามให้ข้อมูลยาว)
    tone: "short", // ✅ Tone Level เริ่มต้น (default = short)
    recentMessages: [],
    lastUpdated: Date.now(),
  };
}

/**
 * อัปเดต state จาก intent result
 * มี protection: ไม่ให้ general_chat reset state ที่มีอยู่แล้ว
 */
export function updateStateFromIntent(
  currentState: ConversationState,
  intentResult: { intent: IntentType; service?: ServiceType | ServiceCategory; area?: Area },
  userMessage: string
): ConversationState {
  // ⚠️ State overwrite protection
  // ถ้า intent เป็น general_chat และ state ไม่ใช่ greeting → อย่า reset state
  if (
    intentResult.intent === "general_chat" &&
    currentState.stage !== "greeting" &&
    currentState.stage !== "waiting_admin"
  ) {
    // อัปเดตแค่ recentMessages และ lastUpdated
    return {
      ...currentState,
      recentMessages: [...currentState.recentMessages.slice(-4), userMessage].slice(-5),
      lastUpdated: Date.now(),
    };
  }

  // ถ้า state เป็น waiting_admin → ห้ามเปลี่ยน (bot หยุดพูด)
  if (currentState.stage === "waiting_admin") {
    return currentState;
  }

  const newState: ConversationState = {
    ...currentState,
    intent: intentResult.intent,
    // ✅ เก็บ preference เดิมไว้ (ไม่ลบเมื่ออัปเดต state)
    preference: currentState.preference || {},
    // ✅ เก็บ tone เดิมไว้ (ไม่ลบเมื่ออัปเดต state)
    // tone จะถูกอัปเดตใน pipeline.ts หลังจาก detectTone()
    tone: currentState.tone || "short",
    recentMessages: [...currentState.recentMessages.slice(-4), userMessage].slice(-5),
    lastUpdated: Date.now(),
  };

  // 🚫 GLOBAL ANTI-BUG RULES (กันเอ๋อ 100%)
  // ❌ ห้าม set service = other ถ้าเคยมี service มาก่อน
  // กติกา: intent เปลี่ยน ≠ เรื่องเปลี่ยน
  // reset ได้ แค่กรณีเดียว: user พูดชัดว่า "เปลี่ยนเรื่องนะ" / "ขอถามอีกอย่าง"
  if (intentResult.service) {
    // ถ้า intentResult.service เป็น "other" แต่ state มี service อยู่แล้ว → เก็บ service เดิม
    if (intentResult.service === "other" && currentState.service && currentState.service !== "other") {
      // เก็บ service เดิมไว้ (ไม่ overwrite)
      newState.service = currentState.service;
      newState.serviceCategory = currentState.serviceCategory || (currentState.service as ServiceCategory);
    } else {
      // อัปเดต service ปกติ
      newState.service = intentResult.service;
      newState.serviceCategory = intentResult.service as ServiceCategory;
    }
    newState.missing.service = false;
  }

  // อัปเดต area
  // 🚫 GLOBAL ANTI-BUG RULES: ❌ ห้ามเดา area
  // คำพวกนี้ ไม่อนุญาตให้ set area: ฟิลเลอร์, ฉีดหน้า, ทำหน้า, เสริม
  // ต้องถามกลับเสมอ: "สนใจทำบริเวณไหนคะ…"
  // 🧩 FIX 1: FIXED AREA SERVICE — ถ้า service มี FIXED AREA → set area อัตโนมัติ
  if (intentResult.area && intentResult.area !== "unknown") {
    newState.area = intentResult.area;
    newState.missing.area = false;
  } else if (newState.service) {
    // ถ้าไม่มี area แต่มี service → เช็คว่า service นี้มี FIXED AREA หรือไม่
    const fixedArea = hasFixedArea(newState.service);
    if (fixedArea) {
      newState.area = fixedArea;
      newState.missing.area = false;
    }
  }

  // อัปเดต stage ตาม intent และข้อมูลที่มี
  if (intentResult.intent === "medical_question") {
    newState.stage = "medical";
  } else if (intentResult.intent === "complaint") {
    newState.stage = "handoff";
  } else if (intentResult.intent === "booking_request") {
    // ⚠️ Booking Readiness Check
    if (!newState.service || !newState.area) {
      // ยังไม่พร้อมจอง → ยังอยู่ใน pricing หรือ service_selected
      if (newState.service) {
        newState.stage = "service_selected";
        newState.missing.area = true;
      } else {
        newState.stage = "exploring";
        newState.missing.service = true;
      }
    } else {
      newState.stage = "booking";
    }
  } else if (intentResult.intent === "aftercare_question") {
    newState.stage = "postcare";
  } else {
    // 🔒 Stage Transition (FINAL) - กฎเหล็ก: ไม่มีทาง pricing ถ้า service ยังไม่ชัด
    // ✅ FINAL STAGE RULE — อิง service + area เท่านั้น (ไม่สน intent แล้ว ณ จุดนี้)
    // 📌 อย่าให้ stage ค้าง
    // 📌 ไม่สน intent แล้ว ณ จุดนี้ → ดูความชัดของข้อมูล
    if (!newState.service) {
      // ยังไม่มี service → exploring
      newState.stage = "exploring";
      newState.missing.service = true;
    } else {
      // เช็คว่า service นี้มี FIXED AREA หรือไม่
      const fixedArea = hasFixedArea(newState.service);
      const hasArea = newState.area || fixedArea;
      
      if (hasArea) {
        // ✅ มีทั้ง service และ area (หรือ FIXED AREA) → pricing เสมอ
        // ❌ ไม่ใช่ service_selected เพราะไม่ต้องเลือก area ต่อ
        newState.stage = "pricing";
        if (fixedArea && !newState.area) {
          // ถ้าเป็น FIXED AREA → set area อัตโนมัติ
          newState.area = fixedArea;
        }
        newState.missing.area = false;
      } else {
        // มี service แต่ยังไม่มี area → service_selected
        newState.stage = "service_selected";
        newState.missing.area = true;
      }
    }
  }

  // ✅ FINAL STAGE RULE — ตรวจสอบซ้ำอีกครั้งเพื่อกันพลาด
  // ถ้า service + area ครบแล้ว → pricing เสมอ (ไม่สน stage เดิม)
  if (newState.service && newState.area && newState.area !== "unknown") {
    newState.stage = "pricing";
    newState.missing.area = false;
  } else if (newState.service && !newState.area) {
    // มี service แต่ยังไม่มี area → service_selected
    newState.stage = "service_selected";
    newState.missing.area = true;
  } else if (!newState.service) {
    // ไม่มี service → exploring
    newState.stage = "exploring";
    newState.missing.service = true;
  }

  return newState;
}

/**
 * เช็คว่ามี question word หรือไม่
 */
function hasQuestionWord(message: string): boolean {
  const lower = message.toLowerCase();
  const questionWords = [
    "อะไร", "ยังไง", "อย่างไร", "เท่าไหร่", "กี่", "เมื่อไหร่", "ที่ไหน",
    "ไหม", "มั้ย", "หรือยัง", "หรือเปล่า",
    "what", "how", "when", "where", "why", "which", "who",
    "?", "?", "？"
  ];
  return questionWords.some(word => lower.includes(word));
}

/**
 * 🔧 FIX 1: เช็คว่าเป็น refinement message หรือไม่
 * Refinement = ข้อความสั้น ๆ ต่อจากบริการเดิม (ไม่ใช่ intent ใหม่)
 * เช่น "อยากทำแบบโด่งๆ", "แบบธรรมชาติ", "สายเกาหลี"
 * 
 * กติกา:
 * ❗ ไม่ใช่ intent ใหม่
 * ❗ ไม่ใช่ service ใหม่
 * ❗ แต่คือ REFINEMENT ของ service เดิม
 * 👉 ห้ามให้ AI คิดใหม่
 * 
 * เงื่อนไข:
 * - ต้องมี service + area ใน state ก่อนหน้า
 * - ข้อความสั้น ๆ (ไม่ยาวเกินไป)
 * - มี keyword ที่เข้าข่าย refinement
 */
export function isRefinementMessage(message: string): boolean {
  const lower = message.toLowerCase().trim();
  
  // ถ้าข้อความยาวเกินไป → ไม่น่าจะเป็น refinement
  if (lower.length > 30) {
    return false;
  }
  
  // คำที่เข้าข่าย refinement
  const refinementKeywords = [
    "โด่ง", "พุ่ง", "ธรรมชาติ", "สาย", "ปลาย", "หวาน", "คม",
    "สายเกาหลี", "สายฝอ", "แบบ", "ทรง", "สไตล์",
    "เล็ก", "ใหญ่", "เรียว", "แหลม", "มน", "หวาน",
    "อยากได้", "ชอบ", "แบบนี้", "แนว"
  ];
  
  // เช็คว่ามี keyword ที่เข้าข่าย refinement
  const hasRefinementKeyword = refinementKeywords.some(keyword => lower.includes(keyword));
  
  // ถ้ามี keyword และข้อความสั้น → น่าจะเป็น refinement
  return hasRefinementKeyword;
}

/**
 * เช็คว่าลูกค้าพิมพ์คำเดียวต่อ (เช่น "รีจูรันครับ") = เลือกจากที่คุยอยู่
 * ⚠️ Strict check: ต้องสั้น + ไม่มี question word + ไม่ใช่ greeting stage
 */
export function isShortFollowUp(
  message: string,
  previousState: ConversationState
): boolean {
  const trimmed = message.trim();
  const words = trimmed.split(/\s+/);
  
  // เงื่อนไข:
  // 1. สั้น (< 15 ตัวอักษร)
  // 2. ไม่มี question word
  // 3. ไม่ใช่ greeting stage
  // 4. มี state ก่อนหน้า (intent ไม่ใช่ undefined)
  return (
    trimmed.length < 15 &&
    words.length <= 3 &&
    !hasQuestionWord(trimmed) &&
    previousState.stage !== "greeting" &&
    previousState.stage !== "waiting_admin" &&
    previousState.intent !== undefined
  );
}
