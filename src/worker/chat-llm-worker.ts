/**
 * PHASE 3 — Chat LLM BullMQ worker
 * Process job: call chatOrchestrate, store result in Redis job:result:{jobId}.
 * Run: npx tsx src/worker/chat-llm-worker.ts (from project root)
 */
import path from "path";
import fs from "fs";
import Redis from "ioredis";
import { Worker } from "bullmq";
import { setJobResult } from "../lib/chat-llm-queue";
import { acquireLlmSlot } from "../lib/llm-semaphore";
import {
  reserveBudgetRedis,
  reconcileBudgetRedis,
} from "../lib/llm-budget-redis";
import { reconcileLLMUsage } from "../lib/llm-cost-transaction";
import { MAX_ESTIMATED_COST_SATANG } from "../lib/llm-cost-transaction";
import { getTodayKeyBangkok } from "../lib/timezone";
import { estimateCostBaht } from "../lib/llm-metrics";
import { toSatang } from "../lib/money";
import {
  isCircuitOpen,
  recordCircuitSuccess,
  recordCircuitFailure,
  OPENAI_CIRCUIT_KEY,
} from "../lib/circuit-breaker";
import { chatOrchestrate } from "../lib/ai/orchestrator";
import type { ChatOrchestratorInput, ChatOrchestratorOutput } from "../lib/ai/orchestrator";

const ACQUIRE_RETRY_MS = 500;
const ACQUIRE_MAX_RETRIES = 10;
const LLM_RETRY_ATTEMPTS = 3;
const LLM_BACKOFF_BASE_MS = 500;

const QUEUE_NAME = "chat-llm";

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#")) {
      const eq = t.indexOf("=");
      if (eq > 0) {
        const k = t.slice(0, eq).trim();
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

const REDIS_URL = process.env.REDIS_URL ?? "";
if (!REDIS_URL) {
  console.error("[Chat LLM Worker] REDIS_URL required");
  process.exit(1);
}

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

async function processJob(job: { id: string; data: ChatOrchestratorInput }): Promise<ChatOrchestratorOutput> {
  const orgId = job.data.org_id ?? "";
  const correlationId = job.data.correlationId ?? job.id;
  const dateKey = getTodayKeyBangkok();

  let slot = await acquireLlmSlot(orgId);
  for (let i = 0; i < ACQUIRE_MAX_RETRIES && !slot.acquired; i++) {
    await new Promise((r) => setTimeout(r, ACQUIRE_RETRY_MS));
    slot = await acquireLlmSlot(orgId);
  }
  if (!slot.acquired) {
    throw new Error(`[Chat LLM Worker] Failed to acquire LLM slot after ${ACQUIRE_MAX_RETRIES} retries (org_id=${orgId})`);
  }

  const reserveResult = await reserveBudgetRedis(orgId, dateKey, MAX_ESTIMATED_COST_SATANG);
  if (!reserveResult.reserved) {
    await slot.release();
    throw new Error(`[Chat LLM Worker] Daily budget limit exceeded (org_id=${orgId})`);
  }

  const circuitOpen = await isCircuitOpen(OPENAI_CIRCUIT_KEY);
  if (circuitOpen) {
    await reconcileBudgetRedis(orgId, dateKey, MAX_ESTIMATED_COST_SATANG, 0);
    await slot.release();
    throw new Error(`[Chat LLM Worker] OpenAI circuit open — temporary isolation (org_id=${orgId})`);
  }

  let lastResult: ChatOrchestratorOutput | null = null;
  let lastError: unknown = null;
  try {
    for (let attempt = 1; attempt <= LLM_RETRY_ATTEMPTS; attempt++) {
      try {
        const result = await chatOrchestrate(job.data);
        lastResult = result;
        await recordCircuitSuccess(OPENAI_CIRCUIT_KEY);
        await setJobResult(job.id, result);

        const usage = result.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        const actualSatang = toSatang(estimateCostBaht(usage));
        await reconcileBudgetRedis(orgId, dateKey, MAX_ESTIMATED_COST_SATANG, actualSatang);
        reconcileLLMUsage(orgId, MAX_ESTIMATED_COST_SATANG, usage, correlationId).catch(() => {});

        return result;
      } catch (err) {
        lastError = err;
        await recordCircuitFailure(OPENAI_CIRCUIT_KEY);
        if (attempt < LLM_RETRY_ATTEMPTS) {
          const backoffMs = LLM_BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, backoffMs));
        } else {
          throw err;
        }
      }
    }
    throw lastError ?? new Error("[Chat LLM Worker] LLM retries exhausted");
  } catch (err) {
    const usage = lastResult?.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const actualSatang = toSatang(estimateCostBaht(usage));
    await reconcileBudgetRedis(orgId, dateKey, MAX_ESTIMATED_COST_SATANG, actualSatang);
    reconcileLLMUsage(orgId, MAX_ESTIMATED_COST_SATANG, usage, correlationId).catch(() => {});
    throw err;
  } finally {
    await slot.release();
  }
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const id = job.id ?? job.name ?? String(Date.now());
    const result = await processJob({ id, data: job.data as ChatOrchestratorInput });
    return result;
  },
  { connection: connection as never }
);

worker.on("completed", (job) => {
  console.log("[Chat LLM Worker] Job completed:", job.id);
});

worker.on("failed", (job, err) => {
  console.error("[Chat LLM Worker] Job failed:", job?.id, err?.message);
});

console.log("[Chat LLM Worker] Started, queue:", QUEUE_NAME);
