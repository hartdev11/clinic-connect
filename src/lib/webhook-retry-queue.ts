/**
 * Phase 18 — Webhook Retry Queue (Dead Letter Queue)
 * เมื่อ webhook ล้มเหลว → เพิ่มใน queue
 * Retry: 1min → 5min → 30min → 4h (exponential backoff)
 * หลัง 4 ครั้ง → Dead Letter → แจ้ง super_admin
 */
import { Queue } from "bullmq";
import { getSharedRedisConnection, isRedisConfigured } from "@/lib/redis-client";
import { buildRetryJobOptions } from "@/lib/queue-defaults";

const QUEUE_NAME = "webhook-retry";

export type WebhookRetryJobData = {
  source: "stripe" | "line";
  eventId: string;
  eventType?: string;
  correlationId?: string;
  /** Stripe: event id for API retrieve; LINE: raw payload */
  payload?: unknown;
};

let _queue: Queue | null = null;

function isConfigured(): boolean {
  return isRedisConfigured();
}

export function getWebhookRetryQueue(): Queue | null {
  if (!isConfigured()) return null;
  if (_queue) return _queue;
  const conn = getSharedRedisConnection();
  if (!conn) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _queue = new Queue(QUEUE_NAME, { connection: conn as any });
  return _queue;
}

export async function enqueueWebhookRetry(data: WebhookRetryJobData): Promise<string | null> {
  const queue = getWebhookRetryQueue();
  if (!queue) return null;
  try {
    const job = await queue.add(
      "retry",
      data,
      buildRetryJobOptions(`${data.source}-${data.eventId}`, { attempts: 4, backoffDelayMs: 60_000 })
    );
    return job.id ?? null;
  } catch (err) {
    console.warn("[WebhookRetry] enqueue failed:", (err as Error)?.message?.slice(0, 80));
    return null;
  }
}
