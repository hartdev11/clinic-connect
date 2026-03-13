/**
 * Phase 11 — BullMQ worker: hourly quota check
 * Run: npx tsx src/worker/quota-check-worker.ts
 */
import path from "path";
import fs from "fs";
import Redis from "ioredis";
import { Worker } from "bullmq";
import { runQuotaCheck } from "@/lib/quota-check";
import { ensureQuotaCheckRepeatableJob } from "@/lib/quota-check-queue";

const QUEUE_NAME = "quota-check";

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
  console.error("[Quota Check Worker] REDIS_URL required");
  process.exit(1);
}

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker(
  QUEUE_NAME,
  async () => {
    const summary = await runQuotaCheck();
    console.log(
      "[Quota Check Worker] Done:",
      summary.totalOrgs,
      "orgs,",
      summary.warningsSent,
      "warnings,",
      summary.exceededBlocked,
      "blocked"
    );
    return summary;
  },
  { connection: connection as never }
);

worker.on("completed", (job) => {
  console.log("[Quota Check Worker] Job completed:", job.id);
});

worker.on("failed", (job, err) => {
  console.error("[Quota Check Worker] Job failed:", job?.id, err?.message);
});

async function main() {
  await ensureQuotaCheckRepeatableJob();
  console.log("[Quota Check Worker] Started, queue:", QUEUE_NAME);
}

main().catch((err) => {
  console.error("[Quota Check Worker] Startup error:", err);
  process.exit(1);
});
