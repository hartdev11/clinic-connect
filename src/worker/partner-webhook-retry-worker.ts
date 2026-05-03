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
import { db } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { postJsonWithRetry } from "@/lib/outbound-http";

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
const OUTBOX_COLLECTION = "partner_webhook_retry_outbox";
const DEAD_LETTER_COLLECTION = "partner_webhook_dead_letters";
const RETRY_DELAY_MS = [60_000, 5 * 60_000, 30 * 60_000, 4 * 60 * 60_000];
const LEASE_MS = 60_000;
let stopping = false;

type OutboxDoc = {
  id: string;
  orgId: string;
  configId: string;
  event: string;
  body: string;
  url: string;
  secret: string;
  correlation_id?: string | null;
  status: "pending" | "retrying" | "processing" | "delivered" | "dead_letter";
  retry_count: number;
  next_attempt_at?: Timestamp | Date | null;
  lease_until?: Timestamp | Date | null;
};

async function processJob(job: { data: PartnerWebhookRetryJobData }): Promise<void> {
  const { url, body, secret } = job.data;
  await sendPartnerWebhook(url, body, secret);
}

async function sendPartnerWebhook(
  url: string,
  body: string,
  secret: string,
  correlationId?: string | null
): Promise<void> {
  const crypto = await import("crypto");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

  const res = await postJsonWithRetry(
    url,
    body,
    {
      "Content-Type": "application/json",
      "X-Clinic-Signature": signature,
      ...(correlationId ? { "X-Correlation-Id": correlationId } : {}),
    },
    { timeoutMs: 10_000, maxAttempts: 3, baseDelayMs: 500 }
  );

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text().then((t) => t.slice(0, 100))}`);
  }
}

function toMillis(value: OutboxDoc["next_attempt_at"]): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (value instanceof Timestamp) return value.toDate().getTime();
  return 0;
}

async function claimOneOutbox(docId: string): Promise<OutboxDoc | null> {
  const ref = db.collection(OUTBOX_COLLECTION).doc(docId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const d = snap.data() as Record<string, unknown>;
    const status = (d.status as OutboxDoc["status"]) ?? "pending";
    if (!(status === "pending" || status === "retrying" || status === "processing")) return null;
    const leaseUntil = d.lease_until;
    const leaseMs = leaseUntil instanceof Timestamp ? leaseUntil.toDate().getTime() : 0;
    if (status === "processing" && leaseMs > Date.now()) return null;
    const nextAttempt = d.next_attempt_at;
    const nextMs = nextAttempt instanceof Timestamp ? nextAttempt.toDate().getTime() : 0;
    if (nextMs > Date.now()) return null;

    tx.update(ref, {
      status: "processing",
      lease_until: new Date(Date.now() + LEASE_MS),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      id: snap.id,
      orgId: String(d.orgId ?? ""),
      configId: String(d.configId ?? ""),
      event: String(d.event ?? ""),
      body: String(d.body ?? ""),
      url: String(d.url ?? ""),
      secret: String(d.secret ?? ""),
      correlation_id: typeof d.correlation_id === "string" ? d.correlation_id : null,
      status: "processing",
      retry_count: typeof d.retry_count === "number" ? d.retry_count : 0,
      next_attempt_at: d.next_attempt_at as Timestamp | Date | null | undefined,
      lease_until: d.lease_until as Timestamp | Date | null | undefined,
    } satisfies OutboxDoc;
  });
}

async function listOutboxCandidates(limit = 20): Promise<string[]> {
  const [pendingSnap, retryingSnap, processingSnap] = await Promise.all([
    db.collection(OUTBOX_COLLECTION).where("status", "==", "pending").limit(limit).get(),
    db.collection(OUTBOX_COLLECTION).where("status", "==", "retrying").limit(limit).get(),
    db.collection(OUTBOX_COLLECTION).where("status", "==", "processing").limit(limit).get(),
  ]);
  return [...pendingSnap.docs, ...retryingSnap.docs, ...processingSnap.docs].map((d) => d.id);
}

async function handleOutboxSuccess(docId: string): Promise<void> {
  await db.collection(OUTBOX_COLLECTION).doc(docId).update({
    status: "delivered",
    deliveredAt: FieldValue.serverTimestamp(),
    lease_until: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function handleOutboxFailure(doc: OutboxDoc, err: Error): Promise<void> {
  const nextRetry = (doc.retry_count ?? 0) + 1;
  const isDead = nextRetry >= RETRY_DELAY_MS.length;
  const ref = db.collection(OUTBOX_COLLECTION).doc(doc.id);
  if (isDead) {
    await ref.update({
      status: "dead_letter",
      retry_count: nextRetry,
      last_error: err.message.slice(0, 500),
      lease_until: null,
      dead_letter_at: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection(DEAD_LETTER_COLLECTION).add({
      orgId: doc.orgId,
      configId: doc.configId,
      event: doc.event,
      body: doc.body,
      url: doc.url,
      reason: err.message.slice(0, 500),
      attempts: nextRetry,
      createdAt: FieldValue.serverTimestamp(),
    });
    await sendWebhookDeadLetterEmail({
      source: "partner",
      eventId: `${doc.configId}-${doc.event}`,
      eventType: doc.event,
      attempts: nextRetry,
    }).catch((e) => console.error("[Partner Webhook] Dead letter email failed:", e?.message));
    return;
  }
  await ref.update({
    status: "retrying",
    retry_count: nextRetry,
    next_attempt_at: new Date(Date.now() + RETRY_DELAY_MS[nextRetry]),
    last_error: err.message.slice(0, 500),
    lease_until: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function drainOutboxOnce(): Promise<void> {
  const ids = await listOutboxCandidates(20);
  for (const id of ids) {
    if (stopping) break;
    const claimed = await claimOneOutbox(id);
    if (!claimed) continue;
    if (toMillis(claimed.next_attempt_at) > Date.now()) continue;
    try {
      await sendPartnerWebhook(claimed.url, claimed.body, claimed.secret, claimed.correlation_id ?? null);
      await handleOutboxSuccess(claimed.id);
    } catch (err) {
      await handleOutboxFailure(claimed, err as Error);
    }
  }
}

async function startOutboxLoop(): Promise<void> {
  while (!stopping) {
    try {
      await drainOutboxOnce();
    } catch (err) {
      console.error("[Partner Webhook Retry Worker] outbox loop error:", (err as Error)?.message);
    }
    await new Promise((r) => setTimeout(r, 3000));
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
void startOutboxLoop();

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[Partner Webhook Retry Worker] ${signal} received, shutting down...`);
  await worker.close().catch(() => {});
  await connection.quit().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
