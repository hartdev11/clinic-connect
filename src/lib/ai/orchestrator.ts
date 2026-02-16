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
import { getCustomerMemory, upsertCustomerMemory, shouldSummarize } from "./customer-memory-store";
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
import type { AnalyticsContext } from "./types";

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

    // Step 2: Role Manager (1 LLM call)
    const customerName = analyticsContext.customer.keyFindings
      .find((f) => f.startsWith("current_customer:"))
      ?.replace("current_customer:", "");

    const rmResult = await runRoleManager({
      userMessage: trimmed,
      analyticsContext: enrichedContext,
      customerName: customerName ?? null,
      correlationId: input.correlationId,
      org_id: input.org_id,
      customerMemorySummary: memory?.summary,
      knowledgeCategory: enrichedContext._knowledgeCategory ?? null,
      channel: input.channel ?? null,
    });

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
    const replyToCustomer =
      blockDueToFinanceClassification || policyViolation || hallucination
        ? "ช่วยตอบเรื่องนี้ไม่ได้ตอนนี้ค่ะ โทรมาคลินิกได้เลยนะคะ"
        : rmResult.reply;

    // Enterprise: Cache high-confidence responses
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
      model_version: "gpt-4o-mini",
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
