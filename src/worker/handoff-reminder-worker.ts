/**
 * Phase 7 — BullMQ worker: handoff reminder (2min → manager, 5min → owner)
 * Run: npx tsx src/worker/handoff-reminder-worker.ts
 */
import path from "path";
import fs from "fs";
import Redis from "ioredis";
import { Worker } from "bullmq";
import { getHandoffSession } from "@/lib/handoff-data";
import { getUsersByOrgId } from "@/lib/clinic-data";
import { sendHandoffReminderEmail } from "@/lib/email";
import type { HandoffReminderJobData } from "@/lib/handoff-queue";

const QUEUE_NAME = "handoff-reminders";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

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
  console.error("[Handoff Reminder Worker] REDIS_URL required");
  process.exit(1);
}

async function processJob(job: { id: string; data: HandoffReminderJobData }): Promise<void> {
  const { sessionId, orgId, delayMinutes } = job.data;

  const session = await getHandoffSession(orgId, sessionId);
  if (!session || session.status !== "pending") {
    return;
  }

  const users = await getUsersByOrgId(orgId);
  const handoffUrl = `${APP_URL.replace(/\/$/, "")}/clinic/handoff`;

  if (delayMinutes === 2) {
    const managers = users.filter((u) => u.role === "manager" && u.email);
    for (const u of managers.slice(0, 3)) {
      if (u.email) {
        await sendHandoffReminderEmail({
          to: u.email,
          customerName: session.customerName,
          triggerType: session.triggerType,
          waitMinutes: 2,
          handoffUrl,
        });
      }
    }
  } else if (delayMinutes === 5) {
    const owners = users.filter((u) => u.role === "owner" && u.email);
    for (const u of owners.slice(0, 3)) {
      if (u.email) {
        await sendHandoffReminderEmail({
          to: u.email,
          customerName: session.customerName,
          triggerType: session.triggerType,
          waitMinutes: 5,
          handoffUrl,
        });
      }
    }
  }
}

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    await processJob({ id: job.id ?? "", data: job.data as HandoffReminderJobData });
  },
  { connection: connection as never }
);

worker.on("completed", (job) => {
  console.log("[Handoff Reminder Worker] Job completed:", job.id);
});

worker.on("failed", (job, err) => {
  console.error("[Handoff Reminder Worker] Job failed:", job?.id, err?.message);
});

console.log("[Handoff Reminder Worker] Started, queue:", QUEUE_NAME);
