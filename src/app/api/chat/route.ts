/**
 * Chat API — 7-Agent System
 * POST /api/chat
 * Body: { message: string, branch_id?: string, userId?: string }
 * org_id มาจาก session เท่านั้น
 * Rate limit: Distributed Firestore (multi-instance safe)
 * Cost guard: Transaction-safe reserve/reconcile
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { chatOrchestrate } from "@/lib/ai/orchestrator";
import {
  checkDistributedRateLimit,
  getClientIp,
  IP_LIMIT,
  ORG_CHAT_LIMIT,
  RateLimitExceededError,
} from "@/lib/distributed-rate-limit";
import { createRequestLogger } from "@/lib/logger";
import {
  reserveLLMBudget,
  reconcileLLMUsage,
  DailyLimitExceededError,
  MAX_ESTIMATED_COST_SATANG,
} from "@/lib/llm-cost-transaction";
import { isGlobalAIDisabled } from "@/lib/llm-cost-guard";
import {
  isOrgCircuitOpen,
  recordRateLimitHit,
  recordLLMError,
  recordLLMSuccess,
  checkAndMaybeOpenCircuit,
} from "@/lib/org-circuit-breaker";
import { recordLLMLatency } from "@/lib/llm-latency-metrics";
import {
  enqueueChatLlmJob,
  pollJobResult,
  getChatLlmQueue,
} from "@/lib/chat-llm-queue";
import { composeSafeFallbackMessage } from "@/lib/agents/safe-fallback";

const QUEUE_POLL_TIMEOUT_MS = 25000;

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const correlationId = requestId;
  const start = Date.now();
  const logger = createRequestLogger({
    requestId,
    correlationId,
    route: "/api/chat",
  });
  let org_id: string | null = null;
  let reservedSatang = 0;

  try {
    const ip = getClientIp(request);
    const ipCheck = await checkDistributedRateLimit(
      `ip:${ip}`,
      IP_LIMIT.max,
      IP_LIMIT.windowSeconds,
      correlationId
    );
    if (!ipCheck.allowed) {
      const retry = "retryAfterMs" in ipCheck ? ipCheck.retryAfterMs : 10;
      const latency = Date.now() - start;
      logger.withLatency(latency, 429).warn("Rate limit triggered (IP)", {
        ip,
        rateLimitType: "ip",
        correlationId,
      });
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retry / 1000)) } }
      );
    }

    const session = await getSessionFromCookies();
    if (!session) {
      const latency = Date.now() - start;
      logger.withLatency(latency, 401).warn("Unauthorized - no session", { correlationId });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    org_id = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!org_id) {
      const latency = Date.now() - start;
      logger.withLatency(latency, 404).warn("Organization not found", { correlationId });
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    logger.withLatency(Date.now() - start).info("Auth ok", {
      org_id,
      user_id: session.user_id,
      correlationId,
    });

    const orgCheck = await checkDistributedRateLimit(
      `org:chat:${org_id}`,
      ORG_CHAT_LIMIT.max,
      ORG_CHAT_LIMIT.windowSeconds,
      correlationId
    );
    if (!orgCheck.allowed) {
      await recordRateLimitHit(org_id).catch(() => {});
      await checkAndMaybeOpenCircuit(org_id).catch(() => {});
      const latency = Date.now() - start;
      const retry = "retryAfterMs" in orgCheck ? orgCheck.retryAfterMs : 60;
      logger.withLatency(latency, 429).warn("Rate limit triggered (org)", {
        org_id,
        rateLimitType: "org",
        correlationId,
      });
      return NextResponse.json(
        { error: "Organisation quota exceeded. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retry / 1000)) } }
      );
    }

    if (isGlobalAIDisabled()) {
      const latency = Date.now() - start;
      logger.withLatency(latency, 503).warn("Global AI disabled", { correlationId });
      return NextResponse.json(
        { error: "AI service is temporarily unavailable." },
        { status: 503 }
      );
    }

    const circuitOpen = await isOrgCircuitOpen(org_id);
    if (circuitOpen) {
      const latency = Date.now() - start;
      logger.withLatency(latency, 429).warn("Org circuit breaker open", {
        org_id,
        correlationId,
      });
      return NextResponse.json(
        { error: "Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const queue = getChatLlmQueue();
    if (!queue) {
      reservedSatang = MAX_ESTIMATED_COST_SATANG;
      await reserveLLMBudget(org_id, reservedSatang, correlationId);
    }

    const body = await request.json();
    const message = body?.message;
    const branch_id = body?.branch_id ?? null;
    const userId = body?.userId ?? null;

    if (!message || typeof message !== "string") {
      const latency = Date.now() - start;
      logger.withLatency(latency, 400).warn("Invalid body - message required", {
        correlationId,
      });
      return NextResponse.json(
        { error: "message is required (string)" },
        { status: 400 }
      );
    }

    const jobPayload = {
      message,
      org_id,
      branch_id,
      userId,
      correlationId,
      channel: "web" as const,
    };

    let result;
    if (queue) {
      const jobId = await enqueueChatLlmJob(jobPayload);
      if (jobId) {
        result = await pollJobResult(jobId, QUEUE_POLL_TIMEOUT_MS);
        if (!result) {
          if (reservedSatang > 0) {
            await reconcileLLMUsage(
              org_id,
              reservedSatang,
              { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
              correlationId
            ).catch(() => {});
          }
          const latency = Date.now() - start;
          logger.withLatency(latency, 200).warn("Chat queue timeout", {
            org_id,
            jobId,
            correlationId,
          });
          return NextResponse.json({
            reply: composeSafeFallbackMessage(),
            success: false,
            meta: { timeout: true },
          });
        }
      } else {
        result = await chatOrchestrate(jobPayload);
      }
    } else {
      result = await chatOrchestrate(jobPayload);
    }

    if (result.success && result.usage) {
      await recordLLMSuccess(org_id).catch(() => {});
      if (reservedSatang > 0) {
        await reconcileLLMUsage(org_id, reservedSatang, result.usage, correlationId).catch(
          (err) =>
            logger.warn("Failed to reconcile LLM usage", {
              err: (err as Error).message,
              correlationId,
            })
        );
      }
      const roleMs = result.roleManagerMs ?? 0;
      await recordLLMLatency(org_id, roleMs, true).catch(() => {});
    } else if (result.error) {
      if (reservedSatang > 0) {
        await reconcileLLMUsage(
          org_id,
          reservedSatang,
          { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          correlationId
        ).catch(() => {});
      }
      await recordLLMError(org_id).catch(() => {});
      await recordLLMLatency(org_id, result.totalMs ?? 0, false).catch(() => {});
      await checkAndMaybeOpenCircuit(org_id).catch(() => {});
    }

    const latency = Date.now() - start;
    logger.withLatency(latency, 200).info("Chat success", {
      org_id,
      statusCode: 200,
      correlationId,
      analyticsMs: result.analyticsMs,
      roleManagerMs: result.roleManagerMs,
      totalMs: result.totalMs,
      llm_prompt_tokens: result.usage?.prompt_tokens,
      llm_completion_tokens: result.usage?.completion_tokens,
    });

    return NextResponse.json({
      reply: result.reply,
      success: result.success,
      meta: {
        analyticsMs: result.analyticsMs,
        roleManagerMs: result.roleManagerMs,
        totalMs: result.totalMs,
      },
    });
  } catch (err) {
    if (org_id && reservedSatang > 0) {
      await reconcileLLMUsage(
        org_id,
        reservedSatang,
        { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        correlationId
      ).catch(() => {});
    }
    if (org_id && !(err instanceof DailyLimitExceededError) && !(err instanceof RateLimitExceededError)) {
      await recordLLMError(org_id).catch(() => {});
    }
    const latency = Date.now() - start;

    if (err instanceof DailyLimitExceededError) {
      logger.withLatency(latency, 429).warn("Daily LLM cost limit exceeded", {
        org_id: err.orgId,
        correlationId,
      });
      return NextResponse.json(
        { error: "Daily AI usage limit reached. Please try again tomorrow." },
        { status: 429 }
      );
    }

    if (err instanceof RateLimitExceededError) {
      logger.withLatency(latency, 429).warn("Rate limit exceeded", {
        correlationId,
      });
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(err.retryAfterMs / 1000)) },
        }
      );
    }

    logger.withLatency(latency, 500).error("Chat error", err as Error, {
      route: "/api/chat",
      correlationId,
      org_id: org_id ?? undefined,
    });

    return NextResponse.json(
      {
        error: "Internal server error",
        reply: "ขออภัยค่ะ เกิดข้อผิดพลาด รบกวนลองใหม่หรือโทรมาคลินิกได้เลยนะคะ 😊",
      },
      { status: 500 }
    );
  }
}
