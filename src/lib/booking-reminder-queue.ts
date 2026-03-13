/**
 * BullMQ queue for 24h booking reminders
 * Job runs at (bookingDateTime - 24h)
 */
import { Queue } from "bullmq";
import Redis from "ioredis";

const QUEUE_NAME = "booking-reminders";

export const REDIS_URL = process.env.REDIS_URL ?? "";

export type BookingReminderJobData = {
  bookingId: string;
  orgId: string;
  /** Optional: LINE userId when known (from customer.externalId or booking.chat_user_id) */
  lineUserId?: string;
  /** Optional: customer doc id for fallback lookup */
  customerId?: string;
};

let _queue: Queue | null = null;

function isConfigured(): boolean {
  return typeof REDIS_URL === "string" && REDIS_URL.length > 0;
}

export function getBookingReminderQueue(): Queue | null {
  if (!isConfigured()) return null;
  if (_queue) return _queue;
  const conn = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
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
  opts?: { lineUserId?: string; customerId?: string }
): Promise<string | null> {
  const queue = getBookingReminderQueue();
  if (!queue) return null;
  const remindAt = new Date(bookingDateTime.getTime() - 24 * 60 * 60 * 1000);
  const delayMs = Math.max(0, remindAt.getTime() - Date.now());
  try {
    const job = await queue.add(
      "remind",
      { bookingId, orgId, lineUserId: opts?.lineUserId, customerId: opts?.customerId } as BookingReminderJobData,
      { delay: delayMs }
    );
    return job.id ?? null;
  } catch {
    return null;
  }
}
