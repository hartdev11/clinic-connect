/**
 * Phase 18 — Billing Reminder Queue
 * BullMQ repeatable job ทุกวัน 09:00 Bangkok (02:00 UTC)
 * ดึง orgs ที่ subscription.current_period_end อยู่ใน 3 วันข้างหน้า
 * ส่ง email + สร้าง notification
 */
import { Queue } from "bullmq";
import Redis from "ioredis";

const QUEUE_NAME = "billing-reminders";
const REDIS_URL = process.env.REDIS_URL ?? "";

export type BillingReminderJobData = Record<string, never>;

let _queue: Queue | null = null;

function isConfigured(): boolean {
  return typeof REDIS_URL === "string" && REDIS_URL.length > 0;
}

export function getBillingReminderQueue(): Queue | null {
  if (!isConfigured()) return null;
  if (_queue) return _queue;
  const conn = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _queue = new Queue(QUEUE_NAME, { connection: conn as any });
  return _queue;
}

/** 09:00 Bangkok = 02:00 UTC */
const CRON_09_BANGKOK = "0 2 * * *";

/** Ensure repeatable job is scheduled (call on worker startup) */
export async function ensureBillingReminderRepeatableJob(): Promise<void> {
  const queue = getBillingReminderQueue();
  if (!queue) return;
  try {
    const repeatable = await queue.getRepeatableJobs();
    const existing = repeatable.find((j) => j.name === "daily" && j.pattern === CRON_09_BANGKOK);
    if (!existing) {
      await queue.add("daily", {} as BillingReminderJobData, {
        repeat: { pattern: CRON_09_BANGKOK },
      });
      console.log("[BillingReminder] Repeatable job scheduled: daily 09:00 Bangkok");
    }
  } catch (err) {
    console.warn("[BillingReminder] Failed to schedule:", (err as Error)?.message);
  }
}
