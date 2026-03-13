/**
 * Phase 21 — BullMQ worker: daily metrics aggregation
 * Run at 02:00 Bangkok. Run manually: npx tsx src/worker/analytics-aggregation-worker.ts
 */
import path from "path";
import fs from "fs";
import Redis from "ioredis";
import { Worker, Queue } from "bullmq";
import { runDailyMetricsAggregation } from "@/lib/analytics-aggregation";

const QUEUE_NAME = "aggregate-daily-metrics";

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
  console.error("[Analytics Aggregation Worker] REDIS_URL required");
  process.exit(1);
}

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export async function ensureAggregationRepeatableJob(): Promise<void> {
  const queue = new Queue(QUEUE_NAME, { connection: connection as never });
  const jobs = await queue.getRepeatableJobs();
    const existing = jobs.find((j) => j.name === "daily");
  if (!existing) {
    await queue.add(
      "daily",
      {},
      {
        repeat: { pattern: "0 19 * * *" },
      }
    );
    console.log("[Analytics Aggregation] Scheduled daily job at 02:00");
  }
}

const worker = new Worker(
  QUEUE_NAME,
  async () => {
    const result = await runDailyMetricsAggregation();
    console.log(
      "[Analytics Aggregation] Done:",
      result.orgsProcessed,
      "orgs,",
      result.dateKey,
      "convs:",
      result.totalConversations,
      "revenue:",
      result.totalRevenue,
      "aiCost:",
      result.totalAiCost
    );
    return result;
  },
  { connection: connection as never }
);

worker.on("completed", (job) => {
  console.log("[Analytics Aggregation] Job completed:", job?.id);
});

worker.on("failed", (job, err) => {
  console.error("[Analytics Aggregation] Job failed:", job?.id, err?.message);
});

async function main() {
  await ensureAggregationRepeatableJob();
  console.log("[Analytics Aggregation Worker] Started, queue:", QUEUE_NAME);
}

main().catch((err) => {
  console.error("[Analytics Aggregation] Startup error:", err);
  process.exit(1);
});
