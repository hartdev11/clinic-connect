/**
 * Phase 16 — Knowledge Learning Worker
 * Process handoff → extract knowledge → quality filter → save to Firestore + Pinecone
 */
import path from "path";
import fs from "fs";
import Redis from "ioredis";
import { Worker } from "bullmq";
import { db } from "@/lib/firebase-admin";
import { extractFromHandoff } from "@/lib/learning/knowledge-extractor";
import { shouldLearn } from "@/lib/knowledge-brain/knowledge-quality-engine";
import {
  saveLearnedItem,
  findSimilarLearned,
  getExistingPrice,
} from "@/lib/learning/learning-service";
import type { KnowledgeLearningJobData } from "@/lib/knowledge-learning-queue";

const QUEUE_NAME = "knowledge-learning";

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
  console.error("[Knowledge Learning Worker] REDIS_URL required");
  process.exit(1);
}

async function processLearningJob(job: { data: KnowledgeLearningJobData }): Promise<{
  learned: number;
  rejected: number;
  reasons: string[];
}> {
  const { handoffId, orgId, excludeIndices } = job.data;
  const reasons: string[] = [];
  let learned = 0;
  let rejected = 0;
  const excludeSet = new Set(excludeIndices ?? []);

  const items = await extractFromHandoff(handoffId, orgId);
  const conversationQuality = 0.75;

  for (let i = 0; i < items.length; i++) {
    if (excludeSet.has(i)) continue;
    const item = items[i]!;
    const similar = await findSimilarLearned(orgId, item.answer ?? item.details ?? "");
    const existingSimilarity = similar?.score;

    let existingPrice: number | null = null;
    if (item.type === "pricing" && item.service) {
      existingPrice = await getExistingPrice(orgId, item.service);
    }

    const result = shouldLearn(
      {
        item,
        conversationQuality,
        existingSimilarity,
        existingPrice: existingPrice ?? undefined,
        sourceAgeDays: 0,
      },
      {}
    );

    if (!result.ok) {
      rejected++;
      reasons.push(`${item.type}: ${result.reason}`);
      continue;
    }

    try {
      await saveLearnedItem(orgId, item, handoffId);
      learned++;
    } catch (err) {
      rejected++;
      reasons.push(`save failed: ${(err as Error)?.message?.slice(0, 50)}`);
    }
  }

  const { FieldValue } = await import("firebase-admin/firestore");
  await db
    .collection("organizations")
    .doc(orgId)
    .collection("handoff_sessions")
    .doc(handoffId)
    .update({
      learningStatus: "done",
      itemsLearned: learned,
      learningProcessedAt: FieldValue.serverTimestamp(),
    });

  return { learned, rejected, reasons };
}

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const result = await processLearningJob({ data: job.data as KnowledgeLearningJobData });
    console.log("[Knowledge Learning Worker]", job.id, "handoff:", job.data.handoffId, result);
    return result;
  },
  { connection: connection as never }
);

worker.on("completed", (job) => {
  console.log("[Knowledge Learning Worker] Job completed:", job.id);
});

worker.on("failed", (job, err) => {
  console.error("[Knowledge Learning Worker] Job failed:", job?.id, err?.message);
});

console.log("[Knowledge Learning Worker] Started, queue:", QUEUE_NAME);
