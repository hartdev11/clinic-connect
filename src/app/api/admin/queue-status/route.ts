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
import { getWebhookRetryQueue } from "@/lib/webhook-retry-queue";
import { getPartnerWebhookRetryQueue } from "@/lib/partner-webhook-retry-queue";
import { getBillingRenewQueue } from "@/lib/billing-renew-queue";
import { getBillingReminderQueue } from "@/lib/billing-reminder-queue";
import { getKnowledgeLearningQueue } from "@/lib/knowledge-learning-queue";

export const dynamic = "force-dynamic";

export interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed?: number;
  paused?: number;
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
      paused: counts.paused ?? 0,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  const [chatLlm, handoff, booking, quota, webhookRetry, partnerWebhookRetry, billingRenew, billingReminder, knowledgeLearning] = await Promise.all([
    getQueueCounts(getChatLlmQueue(), "chat-llm"),
    getQueueCounts(getHandoffQueue(), "handoff-reminders"),
    getQueueCounts(getBookingReminderQueue(), "booking-reminders"),
    getQueueCounts(getQuotaCheckQueue(), "quota-check"),
    getQueueCounts(getWebhookRetryQueue(), "webhook-retry"),
    getQueueCounts(getPartnerWebhookRetryQueue(), "partner-webhook-retry"),
    getQueueCounts(getBillingRenewQueue(), "billing-renew"),
    getQueueCounts(getBillingReminderQueue(), "billing-reminders"),
    getQueueCounts(getKnowledgeLearningQueue(), "knowledge-learning"),
  ]);

  const queues = [chatLlm, handoff, booking, quota, webhookRetry, partnerWebhookRetry, billingRenew, billingReminder, knowledgeLearning].filter(
    (q): q is QueueStatus => q !== null
  );

  return NextResponse.json({ queues });
}
