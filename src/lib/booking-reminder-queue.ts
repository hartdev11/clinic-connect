/**
 * BullMQ queue for 24h booking reminders
 * Job runs at (bookingDateTime - 24h)
 */
import { Queue } from "bullmq";
import { getSharedRedisConnection, isRedisConfigured, REDIS_URL } from "@/lib/redis-client";
import { buildRetryJobOptions } from "@/lib/queue-defaults";

const QUEUE_NAME = "booking-reminders";

export { REDIS_URL };

export type BookingReminderJobData = {
  bookingId: string;
  orgId: string;
  correlationId?: string;
  /** Optional: LINE userId when known (from customer.externalId or booking.chat_user_id) */
  lineUserId?: string;
  /** Optional: customer doc id for fallback lookup */
  customerId?: string;
};

let _queue: Queue | null = null;

function isConfigured(): boolean {
  return isRedisConfigured();
}

export function getBookingReminderQueue(): Queue | null {
  if (!isConfigured()) return null;
  if (_queue) return _queue;
  const conn = getSharedRedisConnection();
  if (!conn) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _queue = new Queue(QUEUE_NAME, { connection: conn as any });
  return _queue;
}

/**
 * Schedule a 24h reminder job.
 * delayMs = bookingDateTime - 24h - now (min 0)
 */
export async function scheduleBookingReminder(
  bookingId: string,
  bookingDateTime: Date,
  orgId: string,
  opts?: { lineUserId?: string; customerId?: string; correlationId?: string }
): Promise<string | null> {
  const queue = getBookingReminderQueue();
  if (!queue) return null;
  const remindAt = new Date(bookingDateTime.getTime() - 24 * 60 * 60 * 1000);
  const delayMs = Math.max(0, remindAt.getTime() - Date.now());
  const reminderJobId = `booking-reminder:${bookingId}`;
  try {
    const existing = await queue.getJob(reminderJobId);
    if (existing) {
      await existing.remove().catch(() => {});
    }
    const job = await queue.add(
      "remind",
      {
        bookingId,
        orgId,
        correlationId: opts?.correlationId,
        lineUserId: opts?.lineUserId,
        customerId: opts?.customerId,
      } as BookingReminderJobData,
      buildRetryJobOptions(reminderJobId, { attempts: 4, backoffDelayMs: 60_000, delayMs })
    );
    return job.id ?? null;
  } catch {
    return null;
  }
}

export async function cancelBookingReminder(bookingId: string): Promise<void> {
  const queue = getBookingReminderQueue();
  if (!queue) return;
  const reminderJobId = `booking-reminder:${bookingId}`;
  const existing = await queue.getJob(reminderJobId);
  if (existing) {
    await existing.remove().catch(() => {});
  }
}
