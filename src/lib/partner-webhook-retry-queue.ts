/**
 * Phase 19 — Partner webhook retry queue
 * ล้มเหลว → retry 1m → 5m → 30m → 4h
 * หลัง 4 ครั้ง → Dead Letter → แจ้ง super_admin
 */
import { Queue } from "bullmq";
import { getSharedRedisConnection, isRedisConfigured } from "@/lib/redis-client";
import { buildRetryJobOptions } from "@/lib/queue-defaults";

const QUEUE_NAME = "partner-webhook-retry";

export type PartnerWebhookRetryJobData = {
  orgId: string;
  configId: string;
  event: string;
  body: string;
  url: string;
  secret: string;
};

let _queue: Queue | null = null;

export function getPartnerWebhookRetryQueue(): Queue | null {
  if (!isRedisConfigured()) return null;
  if (_queue) return _queue;
  const conn = getSharedRedisConnection();
  if (!conn) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _queue = new Queue(QUEUE_NAME, { connection: conn as any });
  return _queue;
}

export async function enqueuePartnerWebhookRetry(
  data: PartnerWebhookRetryJobData
): Promise<string | null> {
  const queue = getPartnerWebhookRetryQueue();
  if (!queue) return null;
  try {
    const job = await queue.add(
      "retry",
      data,
      buildRetryJobOptions(`partner-${data.configId}-${data.event}-${Date.now()}`, {
        attempts: 4,
        backoffDelayMs: 60_000,
      })
    );
    return job.id ?? null;
  } catch (err) {
    console.warn("[PartnerWebhookRetry] enqueue failed:", (err as Error)?.message?.slice(0, 80));
    return null;
  }
}
