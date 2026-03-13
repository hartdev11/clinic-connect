/**
 * Chat Orchestrator — 7-Agent Flow (Enterprise)
 * 0. Pre-LLM Safety — classify, block/escalate ก่อน LLM
 * 1. Customer Memory — โหลด long-term memory
 * 2. เรียก 6 Analytics Agents แบบขนาน
 * 3. Cross-Agent Reasoning
 * 4. Role Manager (1 LLM call) — ใช้ prompt registry, cost governance
 * 5. AI Observability — log activity
 */
import { runAllAnalytics } from "./run-analytics";
import { runRoleManager } from "./role-manager";
import { runCrossAgentReasoning } from "./cross-agent-reasoning";
import { classifyPreLLM, SAFETY_FALLBACK_MESSAGES } from "./pre-llm-safety";
import { getCustomerMemory, upsertCustomerMemory, shouldSummarize, resolveCustomerPersona } from "./customer-memory-store";
import { checkBudgetHardStop } from "./cost-governance";
import { logAIActivity, checkPolicyViolation } from "./ai-observability";
import { runMemorySummarizationForCustomer } from "./memory-summarization";
import {
  getCachedResponse,
  setCachedResponse,
  computeReplyConfidence,
  checkHallucination,
  tagFailure,
} from "./ai-feedback-loop";
import {
  classifyRetrievalComplexity,
  shouldSkipVectorSearch,
  getDeterministicCachedReply,
} from "./cost-aware-retrieval";
import { FAILSAFE_MESSAGE, isFailsafeError } from "@/lib/knowledge-brain/failsafe";
import { acquireLLMSlot } from "./ai-queue";
import { processBookingIntent } from "./booking-intent";
import { routeMessage } from "./model-router";
import { calculate as calculateConfidence, shouldTriggerHandoff } from "./confidence-tracker";
import { recordPipelineMetrics } from "@/lib/ai-pipeline-metrics";
import { getAiConfig } from "@/lib/onboarding";
import { buildEnrichedSystemPrompt } from "./system-prompt-builder";
import { db } from "@/lib/firebase-admin";
import { getRecentConversationForAI } from "@/lib/clinic-data";
import {
  checkAndRewriteAiResponse,
  logSafetyAudit,
} from "./safety-compliance";
import { getGemini } from "@/lib/agents/clients";
import { runCoreBrainConversation, getOrgPlan } from "./core-brain-conversation";
import { mergeAIUsageDailyWithExplicitCost } from "@/lib/ai-usage-daily";
import type { AnalyticsContext } from "./types";

/** Phase 22: Use CoreBrain when Gemini available (or force with USE_CORE_BRAIN=true) */
const USE_CORE_BRAIN =
  process.env.USE_CORE_BRAIN === "true" || !!process.env.GEMINI_API_KEY?.trim();

export interface ChatOrchestratorInput {
  message: string;
  org_id: string;
  branch_id?: string | null;
  userId?: string | null;
  correlationId?: string;
  /** Enterprise: ช่องทางที่ลูกค้าติดต่อ (line, web) — ใช้สำหรับ AI booking */
  channel?: "line" | "web" | null;
}

export interface ChatOrchestratorOutput {
  reply: string;
  success: boolean;
  analyticsMs?: number;
  roleManagerMs?: number;
  totalMs?: number;
  error?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  /** Phase 2 #20: For feedback loop trace */
  correlationId?: string;
  /** When promotion/media exists — channel adapters send images/videos */
  media?: string[];
  /** Phase 12: Model router + confidence + cache */
  model_used?: "template" | "gemini-flash";
  ai_confidence?: number;
  cache_hit?: boolean;
  /** Phase 12: When confidence < 0.65 — trigger handoff, do not send uncertain reply. Phase 15: medical_question */
  handoffTriggered?: { triggerType: "low_ai_confidence" | "medical"; confidence?: number };
}

/**
 * เรียก 7-Agent pipeline
 * ห้ามเรียก LLM มากกว่า 1 ครั้ง
 */
export async function chatOrchestrate(
  input: ChatOrchestratorInput
): Promise<ChatOrchestratorOutput> {
  const start = Date.now();

  const correlationId = input.correlationId ?? `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const trimmed = input.message?.trim();
  if (!trimmed || trimmed.length < 2) {
    return {
      reply: "พิมพ์เพิ่มนิดนึงได้ไหมคะ เดี๋ยวช่วยดูให้",
      success: true,
      totalMs: Date.now() - start,
      correlationId,
    };
  }

  // Phase 7: AI Paused — skip when handoff active
  if (input.org_id && input.userId) {
    const { isConversationAiPaused } = await import("@/lib/handoff-data");
    if (await isConversationAiPaused(input.org_id, input.userId)) {
      return {
        reply: "",
        success: true,
        totalMs: Date.now() - start,
        correlationId,
      };
    }
  }

  // Pre-LLM Safety — block/escalate ก่อนเรียก LLM
  const safety = classifyPreLLM(trimmed);
  if (safety.block || (safety.escalate && safety.classification !== "safe")) {
    const fallback = SAFETY_FALLBACK_MESSAGES[safety.classification];
    if (fallback) {
      return {
        reply: fallback,
        success: true,
        totalMs: Date.now() - start,
      };
    }
  }

  // Phase 15: Requires doctor — sensitive topic + question → escalate, don't answer
  const { requiresDoctor, REQUIRES_DOCTOR_MESSAGE } = await import("./safety-compliance");
  if (requiresDoctor(trimmed)) {
    return {
      reply: REQUIRES_DOCTOR_MESSAGE,
      success: true,
      totalMs: Date.now() - start,
      correlationId,
      handoffTriggered: { triggerType: "medical" },
    };
  }

  // Cost Governance — hard stop ถ้าเกิน budget
  const budgetCheck = await checkBudgetHardStop(input.org_id);
  if (!budgetCheck.allowed) {
    return {
      reply: "โควต้าตอนนี้เต็มแล้วค่ะ ลองใหม่พรุ่งนี้ หรือโทรมาคลินิกได้เลยนะคะ",
      success: false,
      totalMs: Date.now() - start,
      error: budgetCheck.reason,
    };
  }

  // Phase 3 #7: Cost-aware — low complexity or cached FAQ
  const complexity = classifyRetrievalComplexity(trimmed);
  const cachedReply = await getDeterministicCachedReply(input.org_id, trimmed);
  if (cachedReply) {
    return { reply: cachedReply, success: true, totalMs: Date.now() - start, correlationId };
  }
  if (shouldSkipVectorSearch(complexity)) {
    return {
      reply: "สวัสดีค่ะ มีอะไรให้ช่วยบ้างคะ",
      success: true,
      totalMs: Date.now() - start,
      correlationId,
    };
  }

  const cached = await getCachedResponse({ org_id: input.org_id, userMessage: trimmed });
  if (cached) {
    return { reply: cached, success: true, totalMs: Date.now() - start, correlationId };
  }

  // Phase 12: Model Router — greeting/farewell/thanks/booking_confirmation → TemplateEngine (FREE)
  const routeResult = routeMessage(trimmed);
  if (routeResult.model === "template" && routeResult.templateResult) {
    void recordPipelineMetrics(input.org_id, { templateResponse: true });
    return {
      reply: routeResult.templateResult.text,
      success: true,
      totalMs: Date.now() - start,
      correlationId,
      model_used: "template",
    };
  }

  // Enterprise: AI Booking Assistant — จอง/เลื่อน/ยกเลิก
  const hasBookingKeyword = /จอง|booking|นัด|สมัคร|ต้องการนัด/i.test(trimmed);
  const hasPhoneAndProcedure =
    /\b0\d{8,9}\b/.test(trimmed.replace(/\s/g, "")) &&
    /โบท็อกซ์|ฟิลเลอร์|เลเซอร์|วันที่|เวลา|\d+โมง/i.test(trimmed);
  const isBookingIntent = hasBookingKeyword || hasPhoneAndProcedure;
  const bookingResult = await processBookingIntent(trimmed, input.org_id, {
    branchId: input.branch_id,
    channel: input.channel === "line" ? "line" : input.channel === "web" ? "web" : "other",
    userId: input.userId ?? null,
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
      return {
        reply: msg,
        success: true,
        totalMs: Date.now() - start,
        correlationId,
      };
    }
    // no_booking แต่ผู้ใช้มีเจตนาจอง → ห้าม fall through ไปตอบ "ได้เลยค่ะ"
    if (bookingResult.action === "no_booking" && isBookingIntent) {
      return {
        reply:
          "เพื่อจองนัดให้ค่ะ ขอข้อมูลดังนี้: ชื่อ-นามสกุล, เบอร์โทร, บริการ/หัตถการ, วันที่ และเวลาที่ต้องการ พิมพ์ครบทีเดียวหรือทีละข้อก็ได้นะคะ 😊",
        success: true,
        totalMs: Date.now() - start,
        correlationId,
      };
    }
  }

  // Enterprise: Queue / concurrency limit — รอ slot ก่อนเรียก LLM
  const releaseSlot = await acquireLLMSlot(input.org_id);

  const ctx: AnalyticsContext = {
    org_id: input.org_id,
    branch_id: input.branch_id ?? null,
    userId: input.userId ?? null,
    correlationId,
    userMessage: trimmed,
  };

  try {
    // Customer Memory — โหลด long-term (org-isolated)
    const memory = input.userId
      ? await getCustomerMemory(input.org_id, input.userId)
      : null;

    // Step 1: Run 6 Analytics (parallel, no LLM)
    const analyticsContext = await runAllAnalytics(ctx);

    // Cross-Agent Reasoning
    const crossInsights = runCrossAgentReasoning(analyticsContext);
    const enrichedContext = {
      ...analyticsContext,
      _crossAgentInsights: crossInsights,
      _customerMemory: memory?.summary,
    };

    // Phase 6: Customer persona for tone adaptation
    const { persona, toneInstructions } = await resolveCustomerPersona(
      input.org_id,
      input.userId ?? null
    );

    // Phase 13: Lead score → sales mode instructions
    let salesInstructions: string | null = null;
    if (input.userId && input.channel) {
      try {
        const { getLeadScoreForMessage } = await import("./lead-score-updater");
        const { getSalesInstructionsFromScore } = await import("./sales-mode");
        const lead = await getLeadScoreForMessage(input.org_id, input.userId, trimmed);
        salesInstructions = getSalesInstructionsFromScore(lead.score);
      } catch {
        /* ignore */
      }
    }

    // ดึงประวัติแชทล่าสุด (สำหรับให้ AI จำบริบทก่อนหน้า)
    let chatHistory: Array<{ role: string; content: string }> = [];
    if (input.userId && (input.channel === "line" || input.channel === "web")) {
      try {
        chatHistory = await getRecentConversationForAI(input.org_id, input.userId, 5);
        if (process.env.NODE_ENV === "development" && chatHistory.length > 0) {
          console.log("[orchestrator] chatHistory loaded:", chatHistory.length, "turns", {
            roles: chatHistory.map((m) => m.role),
            preview: chatHistory.map((m) => m.content.slice(0, 30) + "..."),
          });
        }
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[orchestrator] getRecentConversationForAI:", (e as Error)?.message?.slice(0, 60));
        }
      }
    }

    // Step 2: LLM call — CoreBrain (Phase 22) or Role Manager
    const customerName = analyticsContext.customer.keyFindings
      .find((f) => f.startsWith("current_customer:"))
      ?.replace("current_customer:", "");

    // Lead score สำหรับ enriched prompt
    let leadScore = 0;
    if (input.userId && input.channel) {
      try {
        const { getLeadScoreForMessage } = await import("./lead-score-updater");
        const lead = await getLeadScoreForMessage(input.org_id, input.userId, trimmed);
        leadScore = lead.score;
      } catch {
        /* ignore */
      }
    }

    // Enriched system prompt — P1-P4 + segment + intent + voice
    let enrichedSystemPrompt: string | undefined;
    try {
      const [orgDoc, aiConfig] = await Promise.all([
        db.collection("organizations").doc(input.org_id).get(),
        getAiConfig(input.org_id),
      ]);
      const orgName = orgDoc.exists ? ((orgDoc.data()?.name as string) ?? "คลินิก") : "คลินิก";
      enrichedSystemPrompt = buildEnrichedSystemPrompt({
        clinicName: orgName,
        voiceId: aiConfig?.voice_id ?? "V03",
        leadScore,
        userMessage: trimmed,
      });
    } catch (e) {
      console.warn("[orchestrator] buildEnrichedSystemPrompt:", (e as Error)?.message?.slice(0, 80));
    }

    let rmResult: {
      reply: string;
      success: boolean;
      totalMs: number;
      error?: string;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      prompt_version?: string;
      prompt_variant?: string;
      cacheHit?: boolean;
      media?: string[];
      internalStrippedForCustomer?: boolean;
    };

    if (USE_CORE_BRAIN && getGemini()) {
      const orgPlan = await getOrgPlan(input.org_id);
      const coreResult = await runCoreBrainConversation({
        userMessage: trimmed,
        orgId: input.org_id,
        branchId: input.branch_id ?? undefined,
        analyticsContext: enrichedContext,
        orgPlan,
        leadScore,
        systemPromptOverride: enrichedSystemPrompt,
        chatHistory: chatHistory.length > 0 ? chatHistory : undefined,
      });
      if (coreResult) {
        rmResult = {
          reply: coreResult.reply,
          success: coreResult.success,
          totalMs: coreResult.totalMs,
          usage: {
            prompt_tokens: Math.floor(coreResult.tokensUsed * 0.8),
            completion_tokens: Math.floor(coreResult.tokensUsed * 0.2),
            total_tokens: coreResult.tokensUsed,
          },
          prompt_version: "core-brain",
          prompt_variant: coreResult.modelUsed,
          cacheHit: coreResult.cached,
        };
        void mergeAIUsageDailyWithExplicitCost(
          input.org_id,
          coreResult.costThb,
          coreResult.tokensUsed,
          "customer_chat"
        ).catch((e) => console.warn("[orchestrator] mergeAIUsageDaily:", (e as Error)?.message?.slice(0, 80)));
        void recordPipelineMetrics(input.org_id, {
          aiCostThb: coreResult.costThb,
          tokensUsed: coreResult.tokensUsed,
        });
      } else {
        rmResult = await runRoleManager({
          userMessage: trimmed,
          analyticsContext: enrichedContext,
          customerName: customerName ?? null,
          correlationId: input.correlationId,
          org_id: input.org_id,
          customerMemorySummary: memory?.summary,
          knowledgeCategory: enrichedContext._knowledgeCategory ?? null,
          channel: input.channel ?? null,
          personaType: persona,
          personaToneInstructions: toneInstructions,
          managerRoute: enrichedContext._managerRoute ?? null,
          salesInstructions,
          systemPromptOverride: enrichedSystemPrompt,
          chatHistory: chatHistory.length > 0 ? chatHistory : undefined,
        });
      }
    } else {
      rmResult = await runRoleManager({
        userMessage: trimmed,
        analyticsContext: enrichedContext,
        customerName: customerName ?? null,
        correlationId: input.correlationId,
        org_id: input.org_id,
        customerMemorySummary: memory?.summary,
        knowledgeCategory: enrichedContext._knowledgeCategory ?? null,
        channel: input.channel ?? null,
        personaType: persona,
        personaToneInstructions: toneInstructions,
        managerRoute: enrichedContext._managerRoute ?? null,
        salesInstructions,
        systemPromptOverride: enrichedSystemPrompt,
        chatHistory: chatHistory.length > 0 ? chatHistory : undefined,
      });
    }

    const totalMs = Date.now() - start;

    // อัปเดต customer memory (increment count)
    if (input.userId) {
      upsertCustomerMemory(input.org_id, input.userId, {
        increment_message_count: true,
      }).catch(() => {});

      // Memory Summarization Job — ทุก X ข้อความ
      const mem = await getCustomerMemory(input.org_id, input.userId);
      if (mem && shouldSummarize(mem)) {
        void runMemorySummarizationForCustomer(input.org_id, input.userId);
      }
    }

    // 🚨 DO NOT EXPOSE FINANCE DATA TO CUSTOMER CHAT
    // (1) Zero-leak: Role Manager strip internal (finance) ก่อนเข้า LLM เมื่อ channel = line/web
    // (2) Explicit guard: ถ้าเป็น customer + มี INTERNAL_FINANCE_ONLY แต่ไม่ได้ strip (เช่น channel ไม่ถูกส่ง) → block ทันที ไม่รอ policyViolation
    const policyViolation = checkPolicyViolation(rmResult.reply);
    const hallucination = checkHallucination(rmResult.reply);
    const isCustomerChannel = input.channel === "line" || input.channel === "web";
    const hasInternalFinance =
      (analyticsContext.finance as { dataClassification?: string })?.dataClassification === "INTERNAL_FINANCE_ONLY";
    const blockDueToFinanceClassification =
      isCustomerChannel && hasInternalFinance && !rmResult.internalStrippedForCustomer;
    if (policyViolation || hallucination) {
      void tagFailure({
        org_id: input.org_id,
        correlation_id: correlationId,
        failure_type: policyViolation ? "policy_violation" : "hallucination",
        reply: rmResult.reply,
        user_message: trimmed,
      });
    }
    // Phase 12: Confidence Tracker — if < 0.65 → handoff, do NOT send uncertain reply
    const ragScore = analyticsContext._retrievalConfidence ?? 0.5;
    const aiConfidenceScore = calculateConfidence({
      response: rmResult.reply,
      ragResults: [{ score: ragScore }],
      intentCertainty: ragScore,
    });
    const shouldHandoff = shouldTriggerHandoff(aiConfidenceScore);

    let replyToCustomer =
      blockDueToFinanceClassification || policyViolation || hallucination
        ? "ช่วยตอบเรื่องนี้ไม่ได้ตอนนี้ค่ะ โทรมาคลินิกได้เลยนะคะ"
        : rmResult.reply;

    // Phase 15: Safety compliance — Phase 22: + voice/emoji compliance
    if (replyToCustomer && !blockDueToFinanceClassification && !policyViolation && !hallucination) {
      const aiConfig = await getAiConfig(input.org_id);
      const medicalPolicy = aiConfig?.medicalPolicy ?? "moderate";
      const safetyResult = await checkAndRewriteAiResponse(
        replyToCustomer,
        input.org_id,
        medicalPolicy,
        {
          conversationId: `${input.org_id}_${input.userId ?? "anon"}`,
          voiceId: aiConfig?.voice_id ?? undefined,
          maxEmojiPerMessage: aiConfig?.max_emoji_per_message,
        }
      );
      replyToCustomer = safetyResult.rewritten;
      if (safetyResult.actionTaken !== "pass") {
        void logSafetyAudit(input.org_id, {
          conversationId: `${input.org_id}_${input.userId ?? "anon"}`,
          content: safetyResult.rewritten.slice(0, 500),
          violationType: safetyResult.safetyLevel,
          riskScore: safetyResult.riskScore,
          actionTaken: safetyResult.actionTaken,
          originalText: rmResult.reply.slice(0, 1000),
          rewrittenText: safetyResult.rewritten,
        });
      }
    }

    // Phase 12: Low confidence → handoff, do not send uncertain response
    let handoffTriggered: ChatOrchestratorOutput["handoffTriggered"] = undefined;
    if (shouldHandoff && !blockDueToFinanceClassification && !policyViolation && !hallucination) {
      replyToCustomer = "กำลังส่งต่อให้เจ้าหน้าที่ค่ะ รอสักครู่จะมีคนติดต่อกลับนะคะ 😊";
      handoffTriggered = { triggerType: "low_ai_confidence", confidence: aiConfidenceScore };
      void logAIActivity({
        org_id: input.org_id,
        correlation_id: correlationId,
        prompt_version: rmResult.prompt_version,
        prompt_variant: rmResult.prompt_variant,
        model_version: rmResult.prompt_variant ?? "gpt-4o-mini",
        total_latency_ms: Date.now() - start,
        extra: { low_ai_confidence_handoff: true, confidence: aiConfidenceScore },
      });
    }

    const analyticsRich =
      analyticsContext.booking.keyFindings.length >= 2 ||
      analyticsContext.promotion.keyFindings.length >= 1 ||
      analyticsContext.knowledge.keyFindings.length >= 1;
    const confidence = computeReplyConfidence(analyticsRich, policyViolation);
    if (confidence >= 0.85 && rmResult.success && !policyViolation && !hallucination) {
      void setCachedResponse({
        org_id: input.org_id,
        userMessage: trimmed,
        reply: rmResult.reply,
        confidence,
        correlationId,
      });
    }

    // Phase 3 #15: Target total orchestration <800ms (retrieval <150ms in knowledge-agent)
    const performanceBreach = totalMs > 800;
    void logAIActivity({
      org_id: input.org_id,
      correlation_id: correlationId,
      prompt_version: rmResult.prompt_version,
      prompt_variant: rmResult.prompt_variant,
      model_version: rmResult.prompt_variant ?? "gpt-4o-mini",
      tokens_used: rmResult.usage
        ? {
            prompt: rmResult.usage.prompt_tokens,
            completion: rmResult.usage.completion_tokens,
            total: rmResult.usage.total_tokens,
          }
        : undefined,
      agents_triggered: ["booking", "promotion", "customer", "finance", "knowledge", "feedback", "role-manager"],
      total_latency_ms: totalMs,
      latency_per_agent_ms: {
        analytics: analyticsContext.totalAnalyticsMs,
        role_manager: rmResult.totalMs,
      },
      policy_violation_detected: policyViolation,
      hallucination_detected: hallucination,
      retrieval_confidence: analyticsContext._retrievalConfidence,
      retrieval_mode: analyticsContext._retrievalMode,
      knowledge_source: analyticsContext._knowledgeSource,
      knowledge_version: analyticsContext._knowledgeVersion,
      knowledge_version_used: analyticsContext._knowledgeVersion,
      similarity_score: analyticsContext._retrievalConfidence,
      quality_score: analyticsContext._knowledgeQualityScore,
      hallucination_flag: hallucination,
      response_confidence: confidence,
      confidence_level: confidence,
      retrieval_knowledge_ids: analyticsContext._retrievalKnowledgeIds,
      performance_breach: performanceBreach,
    });

    if (input.org_id && rmResult.usage) {
      const { recordLLMUsage } = await import("@/lib/llm-metrics");
      void recordLLMUsage(input.org_id, rmResult.usage, { workloadType: "customer_chat" }).catch((e) =>
        console.error("[orchestrator] recordLLMUsage:", e)
      );
    }

    // Phase 12: Record pipeline metrics (cache, confidence)
    const promptTokens = rmResult.usage?.prompt_tokens ?? 0;
    const tokensSavedByCache = rmResult.cacheHit ? Math.round(promptTokens * 0.75) : 0;
    const costSavedThb = rmResult.cacheHit ? (promptTokens / 1_000_000) * 4.125 : 0;
    void recordPipelineMetrics(input.org_id, {
      cacheHit: rmResult.cacheHit,
      aiConfidence: aiConfidenceScore,
      tokensSavedByCache,
      costSavedThb,
    });

    return {
      reply: replyToCustomer,
      success: rmResult.success,
      analyticsMs: analyticsContext.totalAnalyticsMs,
      roleManagerMs: rmResult.totalMs,
      totalMs,
      error: rmResult.error,
      usage: rmResult.usage,
      correlationId,
      media: rmResult.media,
      model_used: "gemini-flash",
      ai_confidence: aiConfidenceScore,
      cache_hit: rmResult.cacheHit,
      handoffTriggered,
    };
  } catch (err) {
    const msg = (err as Error)?.message ?? "Unknown error";
    if (isFailsafeError(err)) {
      return {
        reply: FAILSAFE_MESSAGE,
        success: true,
        totalMs: Date.now() - start,
        correlationId,
      };
    }
    return {
      reply: "เกิดข้อผิดพลาดชั่วคราวค่ะ ลองใหม่อีกที หรือโทรมาคลินิกได้เลยนะคะ",
      success: false,
      totalMs: Date.now() - start,
      error: msg.slice(0, 100),
    };
  } finally {
    releaseSlot();
  }
}
