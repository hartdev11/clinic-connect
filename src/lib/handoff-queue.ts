/**
 * Phase 7 — Handoff Reminder Queue
 * BullMQ delayed jobs: 2min → email manager, 5min → email owner
 */
import { Queue } from "bullmq";
import Redis from "ioredis";

const QUEUE_NAME = "handoff-reminders";
const REDIS_URL = process.env.REDIS_URL ?? "";

export type HandoffReminderJobData = {
  sessionId: string;
  orgId: string;
  lineUserId: string;
  /** 2 | 5 minutes */
  delayMinutes: number;
};

let _queue: Queue | null = null;

function isConfigured(): boolean {
  return typeof REDIS_URL === "string" && REDIS_URL.length > 0;
}

export function getHandoffQueue(): Queue | null {
  if (!isConfigured()) return null;
  if (_queue) return _queue;
  const conn = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
  // BullMQ uses bundled ioredis; project ioredis is compatible at runtime
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
      { sessionId, orgId, lineUserId, delayMinutes: 2 } as HandoffReminderJobData,
      { delay: 2 * 60 * 1000 }
    );
    await queue.add(
      "remind_5min",
      { sessionId, orgId, lineUserId, delayMinutes: 5 } as HandoffReminderJobData,
      { delay: 5 * 60 * 1000 }
    );
  } catch (err) {
    console.warn("[HandoffQueue] schedule failed:", (err as Error)?.message?.slice(0, 80));
  }
}
