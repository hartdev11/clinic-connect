/**
 * Phase 12 — Model Router + TemplateEngine
 * Routes to TemplateEngine (FREE) for simple intents, LLM for complex.
 * Reduces AI cost ~70% by avoiding LLM for greeting/farewell/thanks/booking_confirmation.
 */
export type ModelChoice = "template" | "gemini-flash";

export interface ModelRouterConfig {
  /** Force template for testing */
  forceTemplate?: boolean;
  /** Force LLM for testing */
  forceLlm?: boolean;
}

/** Simple intent classification — keyword-based, no LLM */
export type RouterIntent =
  | "greeting"
  | "farewell"
  | "thanks"
  | "booking_confirmation"
  | "medical"
  | "other";

function classifyIntentForRouter(message: string): RouterIntent {
  const lower = message.toLowerCase().trim();
  const len = lower.length;

  if (len < 2) return "other";

  // greeting — สวัสดี, hello, hi, ฮัลโล, good morning/afternoon
  if (
    /^(สวัสดี|hello|hi|hiya|ฮัลโล|good morning|good afternoon|good evening|สวัสดีค่ะ|สวัสดีครับ)/.test(
      lower
    ) ||
    /^ดี(ค่ะ|ครับ|จ้า)$/.test(lower)
  ) {
    return "greeting";
  }

  // farewell — บาย, ลาก่อน, ขอตัว
  if (
    /^(บาย|bye|ลาก่อน|ขอตัว|ไปก่อน|สวัสดีค่ะ.*ดูแล|ขอบคุณ.*แล้วค่ะ)/.test(lower) ||
    /(ไปก่อน|แล้วพบกัน|ไว้คุยกันใหม่)/.test(lower)
  ) {
    return "farewell";
  }

  // thanks — ขอบคุณ, thank you, ขอบใจ
  if (
    /^(ขอบคุณ|thank|ขอบใจ|ขอบคุณค่ะ|ขอบคุณครับ|ขอบคุณมาก|thanks)/.test(lower) ||
    /(ขอบคุณสำหรับ|ขอบคุณที่ช่วย)/.test(lower)
  ) {
    return "thanks";
  }

  // booking_confirmation — ยืนยันการจอง, จองแล้ว, นัดได้แล้ว
  if (
    /(ยืนยันการจอง|จองแล้ว|นัดได้แล้ว|รับทราบการจอง|บันทึกการนัดไว้แล้ว)/.test(
      lower
    ) ||
    (/^(โอเค|ok|ตกลง).*(จอง|นัด)/.test(lower) && len < 80)
  ) {
    return "booking_confirmation";
  }

  // medical — ต้องใช้ higher temp / more careful
  if (
    /(แพ้|อักเสบ|บวม|เจ็บ|ปวด|มีอาการ|แพทย์|รักษา|ผลข้างเคียง|อาการผิดปกติ)/.test(
      lower
    )
  ) {
    return "medical";
  }

  return "other";
}

const TEMPLATES: Record<"greeting" | "farewell" | "thanks" | "booking_confirmation", string[]> = {
  greeting: [
    "สวัสดีค่ะ ยินดีให้บริการค่ะ 😊",
    "สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ",
    "สวัสดีค่ะ 😊 มีอะไรให้แอดมินช่วยดูหรือแนะนำไหมคะ",
  ],
  farewell: [
    "สวัสดีค่ะ ดูแลตัวเองด้วยนะคะ",
    "ยินดีให้บริการค่ะ มีคำถามเพิ่มเติมแชทมาได้เลยนะคะ 😊",
    "ขอบคุณค่ะ แล้วพบกันนะคะ 😊",
  ],
  thanks: [
    "ยินดีค่ะ 😊",
    "ด้วยความยินดีค่ะ มีอะไรให้ช่วยเพิ่มเติมบอกได้เลยนะคะ",
    "ยินดีค่ะ 😊 มีคำถามอื่นแชทมาได้ตลอดนะคะ",
  ],
  booking_confirmation: [
    "รับทราบค่ะ บันทึกการนัดไว้แล้วนะคะ มีคำถามเพิ่มเติมแชทมาได้เลยค่ะ 😊",
    "ยืนยันการจองให้แล้วค่ะ มีอะไรให้ช่วยเพิ่มเติมบอกได้นะคะ",
    "รับทราบค่ะ แจ้งการนัดไว้ให้แล้วนะคะ 😊",
  ],
};

export interface TemplateResult {
  text: string;
  tokens: { total: number };
  cost_thb: number;
  model_used: "template";
}

/**
 * TemplateEngine — No API call, returns pre-written Thai responses.
 */
export function templateRespond(intent: "greeting" | "farewell" | "thanks" | "booking_confirmation"): TemplateResult {
  const options = TEMPLATES[intent];
  const text = options[Math.floor(Math.random() * options.length)] ?? options[0] ?? "";
  return {
    text,
    tokens: { total: 0 },
    cost_thb: 0,
    model_used: "template",
  };
}

export interface ModelRouterResult {
  model: ModelChoice;
  intent: RouterIntent;
  /** When model=template, pre-filled result */
  templateResult?: TemplateResult;
  /** When model=gemini-flash, optional higher temp for medical */
  temperatureBoost?: boolean;
}

/**
 * ModelRouter.selectModel — Route to template or LLM.
 * greeting | farewell | thanks | booking_confirmation → TemplateEngine (FREE)
 * message < 200 chars → gemini-flash
 * message > 500 chars OR intent = medical → gemini-flash (higher temp)
 * default → gemini-flash
 */
export function selectModel(
  intent: RouterIntent | null,
  messageLength: number,
  config?: ModelRouterConfig
): ModelRouterResult {
  if (config?.forceTemplate) {
    const fallbackIntent: RouterIntent = intent ?? "greeting";
    if (
      fallbackIntent === "greeting" ||
      fallbackIntent === "farewell" ||
      fallbackIntent === "thanks" ||
      fallbackIntent === "booking_confirmation"
    ) {
      return {
        model: "template",
        intent: fallbackIntent,
        templateResult: templateRespond(fallbackIntent),
      };
    }
    return {
      model: "gemini-flash",
      intent: fallbackIntent,
      temperatureBoost: fallbackIntent === "medical",
    };
  }

  if (config?.forceLlm) {
    return {
      model: "gemini-flash",
      intent: intent ?? "other",
      temperatureBoost: intent === "medical",
    };
  }

  // Template path — no API call
  if (
    intent === "greeting" ||
    intent === "farewell" ||
    intent === "thanks" ||
    intent === "booking_confirmation"
  ) {
    return {
      model: "template",
      intent,
      templateResult: templateRespond(intent),
    };
  }

  // LLM path — gemini-flash (maps to existing model)
  return {
    model: "gemini-flash",
    intent: intent ?? "other",
    temperatureBoost: intent === "medical" || messageLength > 500,
  };
}

/**
 * One-shot: classify intent and select model. Use for orchestrator early exit.
 */
export function routeMessage(
  message: string,
  config?: ModelRouterConfig
): ModelRouterResult {
  const intent = classifyIntentForRouter(message);
  const result = selectModel(intent, message.length, config);
  return result;
}
