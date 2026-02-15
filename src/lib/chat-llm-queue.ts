/**
 * PHASE 3 — BullMQ chat-llm queue (no semaphore, no Redis budget)
 * API enqueues job, polls job:result:{jobId} with 25s timeout.
 * Worker processes job, calls chatOrchestrate, stores result in Redis.
 */
import { Queue } from "bullmq";
import Redis from "ioredis";
import { getRedisClient } from "@/lib/redis-client";
import type { ChatOrchestratorInput, ChatOrchestratorOutput } from "@/lib/ai/orchestrator";

const QUEUE_NAME = "chat-llm";
const RESULT_KEY_PREFIX = "job:result:";
const RESULT_TTL_SEC = 60;
const POLL_INTERVAL_MS = 500;

export const REDIS_URL = process.env.REDIS_URL ?? "";

function isQueueConfigured(): boolean {
  return typeof REDIS_URL === "string" && REDIS_URL.length > 0;
}

let _queue: Queue | null = null;
let _queueConnection: Redis | null = null;

/**
 * Get BullMQ Queue (lazy init). Returns null if REDIS_URL not set.
 */
export function getChatLlmQueue(): Queue | null {
  if (!isQueueConfigured()) return null;
  if (_queue) return _queue;
  _queueConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _queue = new Queue(QUEUE_NAME, { connection: _queueConnection as any });
  return _queue;
}

export type ChatLlmJobData = ChatOrchestratorInput;

/**
 * Enqueue chat LLM job. Returns job id or null if queue not configured.
 */
export async function enqueueChatLlmJob(data: ChatLlmJobData): Promise<string | null> {
  const queue = getChatLlmQueue();
  if (!queue) return null;
  try {
    const job = await queue.add("orchestrate", data);
    return job.id ?? null;
  } catch {
    return null;
  }
}

export function getResultKey(jobId: string): string {
  return `${RESULT_KEY_PREFIX}${jobId}`;
}

/**
 * Poll Redis for job result. Returns result or null after timeout.
 */
export async function pollJobResult(
  jobId: string,
  timeoutMs: number
): Promise<ChatOrchestratorOutput | null> {
  const client = await getRedisClient();
  if (!client) return null;
  const key = getResultKey(jobId);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const raw = await client.get(key);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatOrchestratorOutput;
        if (typeof parsed.reply === "string") return parsed;
      }
    } catch {
      // continue polling
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return null;
}

/**
 * Store job result in Redis (called by worker).
 */
export async function setJobResult(jobId: string, result: ChatOrchestratorOutput): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  const key = getResultKey(jobId);
  await client.set(key, JSON.stringify(result), "EX", RESULT_TTL_SEC);
}
