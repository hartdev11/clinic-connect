/**
 * Phase 16 — Knowledge Learning Queue
 * BullMQ: learn from handoff when quality = good
 */
import { Queue } from "bullmq";
import Redis from "ioredis";

const QUEUE_NAME = "knowledge-learning";
const REDIS_URL = process.env.REDIS_URL ?? "";

export type KnowledgeLearningJobData = {
  handoffId: string;
  orgId: string;
  excludeIndices?: number[];
};

let _queue: Queue | null = null;

export function isKnowledgeLearningConfigured(): boolean {
  return typeof REDIS_URL === "string" && REDIS_URL.length > 0;
}

export function getKnowledgeLearningQueue(): Queue | null {
  if (!isKnowledgeLearningConfigured()) return null;
  if (_queue) return _queue;
  const conn = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
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
    const job = await queue.add("learn", {
      handoffId,
      orgId,
      excludeIndices,
    } as KnowledgeLearningJobData);
    return job.id ?? null;
  } catch (err) {
    console.warn("[KnowledgeLearning] enqueue failed:", (err as Error)?.message?.slice(0, 80));
    return null;
  }
}
