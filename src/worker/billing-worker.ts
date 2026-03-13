/**
 * Phase 18 — BullMQ worker: subscription auto-renew (daily 00:00 Bangkok)
 * Run: npx tsx src/worker/billing-worker.ts
 */
import path from "path";
import fs from "fs";
import Redis from "ioredis";
import { Worker } from "bullmq";
import { runBillingRenew } from "@/lib/run-billing-renew";
import { ensureBillingRenewRepeatableJob } from "@/lib/billing-renew-queue";

const QUEUE_NAME = "billing-renew";

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
  console.error("[Billing Worker] REDIS_URL required");
  process.exit(1);
}

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker(
  QUEUE_NAME,
  async () => {
    const summary = await runBillingRenew();
    console.log(
      "[Billing Worker] Done:",
      summary.processed,
      "processed,",
      summary.synced,
      "synced,",
      summary.failed,
      "failed"
    );
    return summary;
  },
  { connection: connection as never }
);

worker.on("completed", (job) => {
  console.log("[Billing Worker] Job completed:", job.id);
});

worker.on("failed", (job, err) => {
  console.error("[Billing Worker] Job failed:", job?.id, err?.message);
});

async function main() {
  await ensureBillingRenewRepeatableJob();
  console.log("[Billing Worker] Started, queue:", QUEUE_NAME);
}

main().catch((err) => {
  console.error("[Billing Worker] Startup error:", err);
  process.exit(1);
});
