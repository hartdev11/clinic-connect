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
import { getLineChannelByOrgId } from "@/lib/line-channel-data";
import { runLineClinicReply } from "@/lib/line-inbound-ai";
import { pushLineMessages, pushLineTextMessage, type LineOutboundMessage } from "@/lib/line-messaging";
import { toSignedUrlIfFirebaseStorage } from "@/lib/promotion-storage";

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
  const { source, eventId, correlationId } = job.data;

  if (source === "stripe") {
    console.log("[Webhook Retry Worker] processing stripe", { eventId, correlationId });
    const stripe = getStripe();
    const event = await stripe.events.retrieve(eventId);
    await processStripeWebhookEvent(event, { correlationId });
  }
  if (source === "line") {
    const payload = (job.data.payload ?? {}) as {
      orgId?: string;
      lineUserId?: string;
      text?: string;
      branchId?: string | null;
      correlationId?: string;
    };
    const orgId = payload.orgId?.trim() ?? "";
    const lineUserId = payload.lineUserId?.trim() ?? "";
    const text = payload.text?.trim() ?? "";
    if (!orgId || !lineUserId || !text) {
      throw new Error(`Invalid LINE retry payload for ${eventId}`);
    }
    const traceId = payload.correlationId ?? correlationId ?? `${source}:${eventId}`;
    const channel = await getLineChannelByOrgId(orgId);
    const token = channel?.channel_access_token?.trim() ?? "";
    if (!token) {
      throw new Error(`LINE channel token missing for org ${orgId}`);
    }
    const { reply, media } = await runLineClinicReply({
      orgId,
      lineUserId,
      text,
      branchId: payload.branchId ?? undefined,
    });
    const outbound: LineOutboundMessage[] = [];
    if (reply.trim()) {
      outbound.push({ type: "text", text: reply.trim() });
    }
    if (media?.length) {
      const signed = await Promise.all(media.slice(0, 4).map((u) => toSignedUrlIfFirebaseStorage(u.trim())));
      for (const url of signed) {
        if (url.startsWith("https://")) {
          outbound.push({ type: "image", originalContentUrl: url, previewImageUrl: url });
        }
      }
    }
    if (outbound.length === 0) {
      throw new Error("LINE retry generated empty outbound message");
    }
    const pushed = await pushLineMessages(token, lineUserId, outbound);
    if (!pushed.ok) {
      const textOnly = outbound.find((m) => m.type === "text");
      if (textOnly && textOnly.type === "text") {
        const fallback = await pushLineTextMessage(token, lineUserId, textOnly.text);
        if (fallback.ok) return;
      }
      throw new Error(`LINE push retry failed: ${pushed.status} ${pushed.body.slice(0, 120)}`);
    }
    console.log("[Webhook Retry Worker] delivered line retry", { eventId, correlationId: traceId });
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
