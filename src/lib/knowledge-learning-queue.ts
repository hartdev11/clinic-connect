/**
 * Phase 16 — Knowledge Learning Queue
 * BullMQ: learn from handoff when quality = good
 */
import { Queue } from "bullmq";
import { getSharedRedisConnection, isRedisConfigured } from "@/lib/redis-client";
import { buildRetryJobOptions } from "@/lib/queue-defaults";

const QUEUE_NAME = "knowledge-learning";

export type KnowledgeLearningJobData = {
  handoffId: string;
  orgId: string;
  excludeIndices?: number[];
};

let _queue: Queue | null = null;

export function isKnowledgeLearningConfigured(): boolean {
  return isRedisConfigured();
}

export function getKnowledgeLearningQueue(): Queue | null {
  if (!isKnowledgeLearningConfigured()) return null;
  if (_queue) return _queue;
  const conn = getSharedRedisConnection();
  if (!conn) return null;
  _queue = new Queue(QUEUE_NAME, { connection: conn as never });
  return _queue;
}

export async function enqueueKnowledgeLearning(
  handoffId: string,
  orgId: string,
  excludeIndices?: number[]
): Promise<string | null> {
  const queue = getKnowledgeLearningQueue();
  if (!queue) return null;
  try {
    const job = await queue.add(
      "learn",
      {
        handoffId,
        orgId,
        excludeIndices,
      } as KnowledgeLearningJobData,
      buildRetryJobOptions(`knowledge-learning:${handoffId}`, { attempts: 3, backoffDelayMs: 60_000 })
    );
    return job.id ?? null;
  } catch (err) {
    console.warn("[KnowledgeLearning] enqueue failed:", (err as Error)?.message?.slice(0, 80));
    return null;
  }
}
