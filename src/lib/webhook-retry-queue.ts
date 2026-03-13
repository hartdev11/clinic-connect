/**
 * Phase 18 — Webhook Retry Queue (Dead Letter Queue)
 * เมื่อ webhook ล้มเหลว → เพิ่มใน queue
 * Retry: 1min → 5min → 30min → 4h (exponential backoff)
 * หลัง 4 ครั้ง → Dead Letter → แจ้ง super_admin
 */
import { Queue } from "bullmq";
import Redis from "ioredis";

const QUEUE_NAME = "webhook-retry";
const REDIS_URL = process.env.REDIS_URL ?? "";

export type WebhookRetryJobData = {
  source: "stripe" | "line";
  eventId: string;
  eventType?: string;
  /** Stripe: event id for API retrieve; LINE: raw payload */
  payload?: unknown;
};

let _queue: Queue | null = null;

function isConfigured(): boolean {
  return typeof REDIS_URL === "string" && REDIS_URL.length > 0;
}

export function getWebhookRetryQueue(): Queue | null {
  if (!isConfigured()) return null;
  if (_queue) return _queue;
  const conn = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _queue = new Queue(QUEUE_NAME, { connection: conn as any });
  return _queue;
}

export async function enqueueWebhookRetry(data: WebhookRetryJobData): Promise<string | null> {
  const queue = getWebhookRetryQueue();
  if (!queue) return null;
  try {
    const job = await queue.add("retry", data, {
      attempts: 4,
      backoff: {
        type: "exponential",
        delay: 60 * 1000, // 1min, 2min, 4min, 8min (approx)
      },
      jobId: `${data.source}-${data.eventId}`,
    });
    return job.id ?? null;
  } catch (err) {
    console.warn("[WebhookRetry] enqueue failed:", (err as Error)?.message?.slice(0, 80));
    return null;
  }
}
