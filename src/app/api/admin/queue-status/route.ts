/**
 * Phase 11 — Admin queue status
 * GET: BullMQ queue depths (waiting, active, completed, failed)
 */
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { getChatLlmQueue } from "@/lib/chat-llm-queue";
import { getHandoffQueue } from "@/lib/handoff-queue";
import { getBookingReminderQueue } from "@/lib/booking-reminder-queue";
import { getQuotaCheckQueue } from "@/lib/quota-check-queue";

export const dynamic = "force-dynamic";

export interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed?: number;
}

async function getQueueCounts(
  queue: { getJobCounts: () => Promise<Record<string, number>> } | null,
  name: string
): Promise<QueueStatus | null> {
  if (!queue) return null;
  try {
    const counts = await queue.getJobCounts();
    return {
      name,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  const [chatLlm, handoff, booking, quota] = await Promise.all([
    getQueueCounts(getChatLlmQueue(), "chat-llm"),
    getQueueCounts(getHandoffQueue(), "handoff-reminders"),
    getQueueCounts(getBookingReminderQueue(), "booking-reminders"),
    getQueueCounts(getQuotaCheckQueue(), "quota-check"),
  ]);

  const queues = [chatLlm, handoff, booking, quota].filter(
    (q): q is QueueStatus => q !== null
  );

  return NextResponse.json({ queues });
}
