/**
 * Phase 19 — BullMQ worker: partner webhook retry
 * Retry failed partner webhook POSTs. หลัง 4 ครั้ง → Dead Letter → แจ้ง super_admin
 * Run: npx tsx src/worker/partner-webhook-retry-worker.ts
 */
import path from "path";
import fs from "fs";
import Redis from "ioredis";
import { Worker } from "bullmq";
import { sendWebhookDeadLetterEmail } from "@/lib/email";
import type { PartnerWebhookRetryJobData } from "@/lib/partner-webhook-retry-queue";

const QUEUE_NAME = "partner-webhook-retry";

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
  console.error("[Partner Webhook Retry Worker] REDIS_URL required");
  process.exit(1);
}

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

async function processJob(job: { data: PartnerWebhookRetryJobData }): Promise<void> {
  const { url, body, secret } = job.data;
  const crypto = await import("crypto");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Clinic-Signature": signature,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text().then((t) => t.slice(0, 100))}`);
  }
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    await processJob({ data: job.data as PartnerWebhookRetryJobData });
  },
  { connection: connection as never }
);

worker.on("completed", (job) => {
  console.log("[Partner Webhook Retry Worker] Job completed:", job.id);
});

worker.on("failed", async (job, err) => {
  console.error("[Partner Webhook Retry Worker] Job failed:", job?.id, err?.message);
  if (job && job.attemptsMade >= (job.opts?.attempts ?? 4) - 1) {
    const data = job.data as PartnerWebhookRetryJobData;
    await sendWebhookDeadLetterEmail({
      source: "partner",
      eventId: `${data.configId}-${data.event}`,
      eventType: data.event,
      attempts: job.attemptsMade + 1,
    }).catch((e) => console.error("[Partner Webhook] Dead letter email failed:", e?.message));
  }
});

console.log("[Partner Webhook Retry Worker] Started, queue:", QUEUE_NAME);
