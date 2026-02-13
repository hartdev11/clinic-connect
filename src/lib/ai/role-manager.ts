/**
 * Role Manager — เรียก LLM เพียง 1 ครั้งต่อข้อความ
 * รับ context จาก 6 Analytics Agents → สร้าง prompt → ตอบลูกค้า
 * Security: Finance context = internal only ห้ามส่งลูกค้า
 * Enterprise: ใช้ Prompt Registry (versioning, rollback, org-specific)
 */
import { getOpenAI } from "@/lib/agents/clients";
import { log } from "@/lib/logger";
import { getPromptContent, DEFAULT_ROLE_MANAGER_PROMPT } from "./prompt-registry";
import {
  freezeAndValidateContext,
  buildDeterministicContext,
  validateOutputAgainstContext,
  selfConsistencyCheck,
} from "./answer-constraint-engine";
import { limitContext } from "./context-limiter";
import {
  isProviderOpen,
  recordProviderFailure,
  recordProviderSuccess,
} from "@/lib/provider-circuit-breaker";
import { sanitizeForLLM } from "./input-sanitizer";
import { llmJudgeReply } from "./llm-judge";
import type { AggregatedAnalyticsContext } from "./types";

const ENABLE_LLM_JUDGE = process.env.ENABLE_LLM_JUDGE !== "false";

const LLM_TIMEOUT_MS = 8000;
const MAX_INPUT_CHARS = 6000;
const MAX_OUTPUT_TOKENS = 220;

/** บีบ context ให้ไม่เกินขีดจำกัด token (ประมาณ 4 chars/token) */
function truncateContext(json: string, maxChars: number): string {
  if (json.length <= maxChars) return json;
  return json.slice(0, maxChars - 20) + '...truncated"}';
}

/** Phase 2 #16 / Phase 3 #11: Safe fallback — โทนมนุษย์ ไม่ template */
const SAFE_FALLBACK_LOW_CONFIDENCE =
  "เรื่องนี้ให้ทีมงานตรวจสอบให้จะแม่นยำกว่าค่ะ โทรหรือแชทมาคลินิกได้เลยนะคะ";

/** Phase 3 #2: Restricted response template (0.70–0.84 confidence) */
const RESTRICTED_RESPONSE_PREFIX =
  "จากข้อมูลที่เรามี: ";

/** Phase 2 #22 / Phase 3 #16: Mandatory disclaimer + escalation path */
const SURGERY_DISCLAIMER =
  " ผลลัพธ์อาจแตกต่างกันไปในแต่ละบุคคล กรุณาปรึกษาแพทย์หรือผู้เชี่ยวชาญก่อนตัดสินใจค่ะ";
const NO_GUARANTEE_CLAUSE = " ข้อมูลนี้เป็นเพียงข้อมูลทั่วไป ไม่ใช่การวินิจฉัยหรือการรักษา กรณีที่ซับซ้อนกรุณาปรึกษาแพทย์โดยตรงค่ะ";

/** Phase 3 #2: Answer Constraint — ห้ามสร้างข้อมูลที่ไม่มีใน context */
const RESPONSE_CONTRACT =
  "ห้ามสร้างข้อมูลที่ไม่มีใน structured context ต้องตอบเฉพาะจาก context ที่ให้เท่านั้น";

const MANDATORY_DISCLAIMER = "ข้อมูลนี้เป็นข้อมูลทั่วไป กรุณาปรึกษาแพทย์หรือผู้เชี่ยวชาญก่อนตัดสินใจค่ะ";

/**
 * Phase 3 #6: Deterministic context — freeze, limit, always risks/contraindications/disclaimer
 */
function buildConstrainedKnowledgeContext(
  knowledge: Record<string, unknown> | null
): { content: string; summary: string } | null {
  if (!knowledge || typeof knowledge !== "object") return null;
  const frozen = freezeAndValidateContext(knowledge, MANDATORY_DISCLAIMER);
  const limited = limitContext(
    frozen as Record<string, unknown>,
    MANDATORY_DISCLAIMER,
    3200
  );
  const deterministic = buildDeterministicContext(frozen, 3200);
  return {
    content: limited.content,
    summary: deterministic,
  };
}

/**
 * สร้าง public context — ส่งให้ลูกค้าได้ (ไม่มี finance)
 * Phase 3 #6: Knowledge ผ่าน context limiter ก่อนส่งเข้า LLM
 */
function buildPublicContext(ctx: AggregatedAnalyticsContext): {
  out: Record<string, unknown>;
  knowledgeSummary: string | null;
} {
  const constrained = buildConstrainedKnowledgeContext(
    (ctx.knowledge as unknown) as Record<string, unknown> | null
  );
  const knowledgeForContext = constrained
    ? { _structured: constrained.content }
    : ctx.knowledge;

  return {
    out: {
      booking: ctx.booking,
      promotion: ctx.promotion,
      customer: ctx.customer,
      knowledge: knowledgeForContext,
      feedback: ctx.feedback,
      _meta: { analyticsMs: ctx.totalAnalyticsMs },
    },
    knowledgeSummary: constrained?.summary ?? null,
  };
}

/**
 * สร้าง internal context — สำหรับ Role Manager เท่านั้น ห้ามเอ่ยกับลูกค้า
 */
function buildInternalContext(ctx: AggregatedAnalyticsContext): Record<string, unknown> {
  return {
    finance: ctx.finance,
    _note: "INTERNAL_ONLY — ห้ามพูดตัวเลขรายได้/ยอดขายกับลูกค้า ใช้แค่เข้าใจแนวโน้ม",
  };
}

/** Fallback เมื่อ registry ไม่มีข้อมูล — ใช้ default full prompt */
const SYSTEM_PROMPT_FALLBACK = DEFAULT_ROLE_MANAGER_PROMPT;

export interface RoleManagerInput {
  userMessage: string;
  analyticsContext: AggregatedAnalyticsContext;
  customerName?: string | null;
  customerMemorySummary?: string | null;
  correlationId?: string;
  org_id?: string;
  /** Phase 2 #16: category สำหรับ append disclaimer ถ้า surgery */
  knowledgeCategory?: string | null;
}

export interface RoleManagerOutput {
  reply: string;
  success: boolean;
  totalMs: number;
  error?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  prompt_version?: string;
  prompt_variant?: string;
}

export async function runRoleManager(
  input: RoleManagerInput
): Promise<RoleManagerOutput> {
  const start = Date.now();

  const openai = getOpenAI();
  if (!openai) {
    return {
      reply: "ตอนนี้ระบบกำลังปรับปรุงอยู่ค่ะ โทรหรือแชทมาทีมงานได้เลยนะคะ",
      success: false,
      totalMs: Date.now() - start,
      error: "OPENAI_API_KEY not configured",
    };
  }

  if (isProviderOpen("openai")) {
    return {
      reply: SAFE_FALLBACK_LOW_CONFIDENCE,
      success: true,
      totalMs: Date.now() - start,
      error: "openai_circuit_open",
    };
  }

  // Phase 2 #16 / Phase 3 #1: abstain → safe fallback immediately
  const retrievalMode = input.analyticsContext._retrievalMode ?? "abstain";
  if (retrievalMode === "abstain") {
    return {
      reply: SAFE_FALLBACK_LOW_CONFIDENCE,
      success: true,
      totalMs: Date.now() - start,
    };
  }

  const { content: basePrompt, version: promptVersion, variant: promptVariant } = await getPromptContent("role-manager", {
    org_id: input.org_id,
    useDefault: SYSTEM_PROMPT_FALLBACK,
  });

  // Phase 3 #2: Append response contract to prevent hallucination
  const systemPrompt = `${basePrompt}\n\n[CRITICAL] ${RESPONSE_CONTRACT}`;

  const { out: publicCtx, knowledgeSummary } = buildPublicContext(input.analyticsContext);
  const internalCtx = buildInternalContext(input.analyticsContext);

  const contextStr = JSON.stringify(
    {
      public: publicCtx,
      internal: internalCtx,
      customerName: input.customerName ?? null,
      customerMemorySummary: input.customerMemorySummary ?? null,
      crossAgentInsights: input.analyticsContext._crossAgentInsights ?? [],
    },
    null,
    2
  );

  const truncated = truncateContext(contextStr, MAX_INPUT_CHARS);

  const isRestricted = retrievalMode === "restricted";
  const restrictedNote = isRestricted
    ? "\n[จำกัด] ตอบเฉพาะจาก context เท่านั้น ไม่ extrapolate"
    : "";

  const sanitizedMessage = sanitizeForLLM(input.userMessage);
  const userContent = `ข้อความลูกค้า: "${sanitizedMessage}"

Context จาก Analytics:
${truncated}${restrictedNote}

ตอบลูกค้าแบบมนุษย์จริง — คิดเอง แก้ปัญหาเอง ได้ใจความ ไม่อัตโนมัติ (สั้น 2–4 ประโยค ไม่มีคำนำ):`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    const modelConfig = await import("./model-versioning").then((m) =>
      m.getModelConfig(input.org_id ?? undefined)
    );

    const completion = await openai.chat.completions.create(
      {
        model: modelConfig.model_name,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: modelConfig.max_tokens,
        temperature: modelConfig.temperature,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);
    recordProviderSuccess("openai");

    let reply =
      completion.choices[0]?.message?.content?.trim() ||
      "ช่วยตอบเรื่องนี้ไม่ได้ตอนนี้ค่ะ โทรมาคลินิกได้เลยนะคะ";

    // Phase 3 #2: Schema-based + self-consistency + LLM-as-judge (world-class)
    if (knowledgeSummary) {
      const validation = validateOutputAgainstContext(reply, knowledgeSummary);
      const consistent = selfConsistencyCheck(reply, knowledgeSummary);
      if (!validation.valid || !consistent) {
        log.warn("Role Manager output validation failed", {
          correlationId: input.correlationId,
          org_id: input.org_id,
          violations: validation.violations,
          selfConsistent: consistent,
        });
        reply = SAFE_FALLBACK_LOW_CONFIDENCE;
      } else if (ENABLE_LLM_JUDGE && reply.length > 30) {
        const judgeResult = await llmJudgeReply(reply, knowledgeSummary, {
          correlationId: input.correlationId,
          org_id: input.org_id,
        });
        if (judgeResult === "UNSAFE") {
          log.warn("LLM Judge: UNSAFE", { correlationId: input.correlationId, org_id: input.org_id });
          reply = SAFE_FALLBACK_LOW_CONFIDENCE;
        }
      }
    }

    // Phase 2 #22: append disclaimer ถ้า category = surgery
    const isSurgery = /surgery|ศัลยกรรม|ผ่าตัด|เลเซอร์|ฉีด|ฟิลเลอร์|โบลาท็อกซ์/i.test(
      input.knowledgeCategory ?? ""
    );
    if (isSurgery && !reply.includes("ปรึกษาแพทย์") && !reply.includes("ผู้เชี่ยวชาญ")) {
      reply = reply.trimEnd() + SURGERY_DISCLAIMER;
    }
    if (isSurgery && !reply.includes("ไม่ใช่การวินิจฉัย")) {
      reply = reply.trimEnd() + NO_GUARANTEE_CLAUSE;
    }

    const totalMs = Date.now() - start;
    const usage = completion.usage
      ? {
          prompt_tokens: completion.usage.prompt_tokens ?? 0,
          completion_tokens: completion.usage.completion_tokens ?? 0,
          total_tokens: completion.usage.total_tokens ?? 0,
        }
      : undefined;

    return {
      reply,
      success: true,
      totalMs,
      usage,
      prompt_version: promptVersion,
      prompt_variant: promptVariant,
    };
  } catch (err) {
    recordProviderFailure("openai");
    const msg = (err as Error)?.message ?? "Unknown error";
    const isAbort = msg.includes("abort") || msg.includes("timeout");

    log.warn("Role Manager LLM error", {
      correlationId: input.correlationId,
      org_id: input.org_id,
      error: msg.slice(0, 100),
    });

    return {
      reply: "ตอนนี้ข้อความเข้ามาเยอะ รอสักครู่แล้วลองใหม่ หรือโทรมาคลินิกได้เลยค่ะ",
      success: false,
      totalMs: Date.now() - start,
      error: isAbort ? "timeout" : msg.slice(0, 100),
    };
  }
}
