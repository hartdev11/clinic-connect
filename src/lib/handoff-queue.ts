/**
 * Phase 7 — Handoff Reminder Queue
 * BullMQ delayed jobs: 2min → email manager, 5min → email owner
 */
import { Queue } from "bullmq";
import { getSharedRedisConnection, isRedisConfigured } from "@/lib/redis-client";
import { buildRetryJobOptions } from "@/lib/queue-defaults";

const QUEUE_NAME = "handoff-reminders";

export type HandoffReminderJobData = {
  sessionId: string;
  orgId: string;
  lineUserId: string;
  /** 2 | 5 minutes */
  delayMinutes: number;
};

let _queue: Queue | null = null;

export function getHandoffQueue(): Queue | null {
  if (!isRedisConfigured()) return null;
  if (_queue) return _queue;
  const conn = getSharedRedisConnection();
  if (!conn) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _queue = new Queue(QUEUE_NAME, { connection: conn as any });
  return _queue;
}

/** Schedule 2min and 5min reminder jobs */
export async function scheduleHandoffReminder(
  sessionId: string,
  orgId: string,
  lineUserId: string
): Promise<void> {
  const queue = getHandoffQueue();
  if (!queue) return;
  try {
    await queue.add(
      "remind_2min",
      { sessionId, orgId, lineUserId, delayMinutes: 2 } satisfies HandoffReminderJobData,
      buildRetryJobOptions(`handoff:${sessionId}:2m`, {
        attempts: 4,
        backoffDelayMs: 60_000,
        delayMs: 2 * 60 * 1000,
      })
    );
    await queue.add(
      "remind_5min",
      { sessionId, orgId, lineUserId, delayMinutes: 5 } satisfies HandoffReminderJobData,
      buildRetryJobOptions(`handoff:${sessionId}:5m`, {
        attempts: 4,
        backoffDelayMs: 60_000,
        delayMs: 5 * 60 * 1000,
      })
    );
  } catch (err) {
    console.warn("[HandoffQueue] schedule failed:", (err as Error)?.message?.slice(0, 80));
  }
}
