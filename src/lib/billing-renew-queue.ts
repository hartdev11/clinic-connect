/**
 * Phase 18 — Subscription Auto-Renew Queue
 * BullMQ repeatable job ทุกวัน 00:00 Bangkok (17:00 UTC)
 */
import { Queue } from "bullmq";
import Redis from "ioredis";

const QUEUE_NAME = "billing-renew";
const REDIS_URL = process.env.REDIS_URL ?? "";

export type BillingRenewJobData = Record<string, never>;

let _queue: Queue | null = null;

function isConfigured(): boolean {
  return typeof REDIS_URL === "string" && REDIS_URL.length > 0;
}

export function getBillingRenewQueue(): Queue | null {
  if (!isConfigured()) return null;
  if (_queue) return _queue;
  const conn = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _queue = new Queue(QUEUE_NAME, { connection: conn as any });
  return _queue;
}

/** 00:00 Bangkok = 17:00 UTC */
const CRON_00_BANGKOK = "0 17 * * *";

export async function ensureBillingRenewRepeatableJob(): Promise<void> {
  const queue = getBillingRenewQueue();
  if (!queue) return;
  try {
    const repeatable = await queue.getRepeatableJobs();
    const existing = repeatable.find((j) => j.name === "daily" && j.pattern === CRON_00_BANGKOK);
    if (!existing) {
      await queue.add("daily", {} as BillingRenewJobData, {
        repeat: { pattern: CRON_00_BANGKOK },
      });
      console.log("[BillingRenew] Repeatable job scheduled: daily 00:00 Bangkok");
    }
  } catch (err) {
    console.warn("[BillingRenew] Failed to schedule:", (err as Error)?.message);
  }
}
