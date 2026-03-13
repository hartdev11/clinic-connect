/**
 * Phase 22 — Core Brain (Layer 1)
 * Gemini wrapper + caching + model selection by complexity & plan
 */
import { createHash } from "crypto";
import { getGemini } from "@/lib/agents/clients";
import { getRedisClient, isRedisConfigured } from "@/lib/redis-client";

const CACHE_KEY_PREFIX = "core_brain:";
const CACHE_TTL_SEC = 300;

/** Plan → max model tier */
export type PlanTier = "basic" | "professional" | "business" | "enterprise";

const PLAN_TO_TIER: Record<string, PlanTier> = {
  starter: "basic",
  professional: "professional",
  multi_branch: "business",
  enterprise: "enterprise",
};

export type ModelTier = "free" | "flash" | "pro";

/** Cost THB per 1M tokens (input+output avg) */
const MODEL_COST_THB_PER_1M: Record<string, number> = {
  "gemini-2.0-flash-exp": 0,
  "gemini-1.5-flash": 0.7,
  "gemini-1.5-pro": 2.8,
};

/** Medical complexity triggers — force pro or flash */
const MEDICAL_TRIGGERS =
  /ผลข้างเคียง|contraindication|แพ้|โรคประจำตัว|ตั้งครรภ์|เปรียบเทียบ/i;

export interface CoreBrainGenerateParams {
  systemPrompt: string;
  userMessage: string;
  chatHistory?: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
  useCache?: boolean;
  model?: string;
  /** Org plan for model selection: starter, professional, multi_branch, enterprise */
  planTier?: PlanTier;
}

export interface CoreBrainGenerateResult {
  response: string;
  tokensUsed: number;
  modelUsed: string;
  latencyMs: number;
  cached: boolean;
  costThb: number;
}

function selectModelByComplexity(
  message: string,
  planTier: PlanTier
): string {
  const hasMedical = MEDICAL_TRIGGERS.test(message);
  const len = message.length;
  const isSimple = len < 100 && !hasMedical;
  const isComplex = hasMedical || /เปรียบเทียบ|ต่างกัน|อันไหนดี/i.test(message) || len > 300;

  if (planTier === "basic") {
    return "gemini-2.0-flash-exp";
  }
  if (isSimple && (planTier === "professional" || planTier === "business" || planTier === "enterprise")) {
    return "gemini-2.0-flash-exp";
  }
  if (planTier === "professional") {
    return isComplex ? "gemini-1.5-flash" : "gemini-2.0-flash-exp";
  }
  if (planTier === "business" || planTier === "enterprise") {
    return isComplex ? "gemini-1.5-pro" : "gemini-1.5-flash";
  }
  return "gemini-2.0-flash-exp";
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function computeCostThb(
  model: string,
  tokensUsed: number,
  cached: boolean
): number {
  const baseCost = (MODEL_COST_THB_PER_1M[model] ?? 0.7) * (tokensUsed / 1_000_000);
  return cached ? baseCost * 0.55 : baseCost;
}

export class CoreBrain {
  async generate(params: CoreBrainGenerateParams): Promise<CoreBrainGenerateResult> {
    const {
      systemPrompt,
      userMessage,
      chatHistory = [],
      temperature = 0.85,
      maxTokens = 800,
      useCache = true,
      model: overrideModel,
      planTier = "professional",
    } = params;

    const model =
      overrideModel ?? selectModelByComplexity(userMessage, planTier);
    const start = Date.now();

    if (useCache && isRedisConfigured()) {
      const cacheKey = `${CACHE_KEY_PREFIX}${createHash("sha256")
        .update(`${systemPrompt}\n---\n${userMessage}\n---\n${JSON.stringify(chatHistory)}`)
        .digest("hex")
        .slice(0, 32)}`;
      const redis = await getRedisClient();
      if (redis) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached) as {
              response: string;
              tokensUsed: number;
              modelUsed: string;
            };
            return {
              ...parsed,
              latencyMs: Date.now() - start,
              cached: true,
              costThb: computeCostThb(parsed.modelUsed, parsed.tokensUsed, true),
            };
          }
        } catch {
          /* ignore cache read error */
        }
      }
    }

    const gemini = getGemini();
    if (!gemini) {
      return {
        response:
          "ตอนนี้ระบบกำลังปรับปรุงอยู่ค่ะ โทรหรือแชทมาทีมงานได้เลยนะคะ",
        tokensUsed: 0,
        modelUsed: model,
        latencyMs: Date.now() - start,
        cached: false,
        costThb: 0,
      };
    }

    // Gemini ต้องการ role: "user" | "model" — getRecentConversationForAI ส่ง "assistant"
    // ต้อง map "assistant" → "model" ไม่งั้น history ถูกละเลยทั้งหมด
    const contents: Array<{ role: "user" | "model"; parts: [{ text: string }] }> = [];
    for (const msg of chatHistory) {
      const role = msg.role === "assistant" ? "model" : msg.role === "user" || msg.role === "model" ? msg.role : null;
      if (role && msg.content?.trim()) {
        contents.push({
          role: role as "user" | "model",
          parts: [{ text: String(msg.content).trim() }],
        });
      }
    }
    contents.push({ role: "user", parts: [{ text: userMessage }] });

    try {
      const response = await gemini.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature,
          maxOutputTokens: maxTokens,
        },
      });

      const text = (response?.text ?? "").trim();
      const promptTokens = estimateTokens(systemPrompt + userMessage + JSON.stringify(chatHistory));
      const completionTokens = estimateTokens(text);
      const tokensUsed = promptTokens + completionTokens;
      const result: CoreBrainGenerateResult = {
        response: text || "ขออภัยค่ะ ตอนนี้ยังตอบไม่ได้ กรุณาติดต่อเจ้าหน้าที่ค่ะ",
        tokensUsed,
        modelUsed: model,
        latencyMs: Date.now() - start,
        cached: false,
        costThb: computeCostThb(model, tokensUsed, false),
      };

      if (useCache && isRedisConfigured() && text) {
        const cacheKey = `${CACHE_KEY_PREFIX}${createHash("sha256")
          .update(`${systemPrompt}\n---\n${userMessage}\n---\n${JSON.stringify(chatHistory)}`)
          .digest("hex")
          .slice(0, 32)}`;
        const redis = await getRedisClient();
        if (redis) {
          try {
            await redis.setex(
              cacheKey,
              CACHE_TTL_SEC,
              JSON.stringify({
                response: result.response,
                tokensUsed: result.tokensUsed,
                modelUsed: result.modelUsed,
              })
            );
          } catch {
            /* ignore cache write error */
          }
        }
      }

      return result;
    } catch (err) {
      console.warn("[CoreBrain] Gemini error:", (err as Error)?.message?.slice(0, 120));
      return {
        response:
          "เกิดข้อผิดพลาดชั่วคราวค่ะ ลองใหม่อีกที หรือโทรมาคลินิกได้เลยนะคะ",
        tokensUsed: 0,
        modelUsed: model,
        latencyMs: Date.now() - start,
        cached: false,
        costThb: 0,
      };
    }
  }
}

/** Singleton instance */
let _coreBrain: CoreBrain | null = null;

export function getCoreBrain(): CoreBrain {
  if (!_coreBrain) _coreBrain = new CoreBrain();
  return _coreBrain;
}

/** Map org plan to tier for CoreBrain */
export function planToTier(plan: string): PlanTier {
  return PLAN_TO_TIER[plan] ?? "professional";
}
