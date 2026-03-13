/**
 * Phase 18 — BullMQ worker: webhook retry
 * Retry failed webhooks (Stripe/LINE). หลัง 4 ครั้ง → Dead Letter → แจ้ง super_admin
 * Run: npx tsx src/worker/webhook-retry-worker.ts
 */
import path from "path";
import fs from "fs";
import Redis from "ioredis";
import { Worker } from "bullmq";
import { getStripe } from "@/lib/stripe";
import { processStripeWebhookEvent } from "@/lib/stripe-webhook-handler";
import { sendWebhookDeadLetterEmail } from "@/lib/email";
import type { WebhookRetryJobData } from "@/lib/webhook-retry-queue";

const QUEUE_NAME = "webhook-retry";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#")) {
      const eq = t.indexOf("=");
      if (eq > 0) {
        const k = t.slice(0, eq).trim();
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

const REDIS_URL = process.env.REDIS_URL ?? "";
if (!REDIS_URL) {
  console.error("[Webhook Retry Worker] REDIS_URL required");
  process.exit(1);
}

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

async function processJob(job: { id: string; data: WebhookRetryJobData }): Promise<void> {
  const { source, eventId } = job.data;

  if (source === "stripe") {
    const stripe = getStripe();
    const event = await stripe.events.retrieve(eventId);
    await processStripeWebhookEvent(event);
  }
  // LINE: reply token expires quickly, skip replay for now
  if (source === "line") {
    throw new Error("LINE webhook retry not implemented (reply token expires)");
  }
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    await processJob({
      id: job.id ?? "",
      data: job.data as WebhookRetryJobData,
    });
  },
  { connection: connection as never }
);

worker.on("completed", (job) => {
  console.log("[Webhook Retry Worker] Job completed:", job.id);
});

worker.on("failed", async (job, err) => {
  console.error("[Webhook Retry Worker] Job failed:", job?.id, err?.message);
  if (job && job.attemptsMade >= (job.opts?.attempts ?? 4) - 1) {
    const data = job.data as WebhookRetryJobData;
    await sendWebhookDeadLetterEmail({
      source: data.source,
      eventId: data.eventId,
      eventType: data.eventType,
      attempts: job.attemptsMade + 1,
    }).catch((e) => console.error("[Webhook Retry] Dead letter email failed:", e?.message));
  }
});

console.log("[Webhook Retry Worker] Started, queue:", QUEUE_NAME);
