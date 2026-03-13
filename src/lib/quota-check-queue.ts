/**
 * Phase 11 — Hourly quota check BullMQ queue
 * Repeatable job every 1 hour: check all active orgs, enforce quota limits
 */
import { Queue } from "bullmq";
import Redis from "ioredis";

const QUEUE_NAME = "quota-check";
const REDIS_URL = process.env.REDIS_URL ?? "";

export type QuotaCheckJobData = Record<string, never>;

let _queue: Queue | null = null;

function isConfigured(): boolean {
  return typeof REDIS_URL === "string" && REDIS_URL.length > 0;
}

export function getQuotaCheckQueue(): Queue | null {
  if (!isConfigured()) return null;
  if (_queue) return _queue;
  const conn = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _queue = new Queue(QUEUE_NAME, { connection: conn as any });
  return _queue;
}

/** Ensure repeatable job is scheduled (call on worker startup) */
export async function ensureQuotaCheckRepeatableJob(): Promise<void> {
  const queue = getQuotaCheckQueue();
  if (!queue) return;
  try {
    const repeatable = await queue.getRepeatableJobs();
    const existing = repeatable.find((j) => j.name === "hourly" && j.pattern === "0 * * * *");
    if (!existing) {
      await queue.add("hourly", {} as QuotaCheckJobData, {
        repeat: { pattern: "0 * * * *" }, // Every hour at :00
      });
      console.log("[QuotaCheck] Repeatable job scheduled: every hour");
    }
  } catch (err) {
    console.warn("[QuotaCheck] Failed to schedule repeatable job:", (err as Error)?.message);
  }
}
