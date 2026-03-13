/**
 * Phase 16 — Run learning from handoff
 * Phase 24 — Quality evaluation: auto-approve / queue / reject
 * Called immediately (excellent) or from worker (good)
 */
import { db } from "@/lib/firebase-admin";
import { extractFromHandoff, evaluateQuality } from "./knowledge-extractor";
import { shouldLearn } from "@/lib/knowledge-brain/knowledge-quality-engine";
import {
  saveLearnedItem,
  findSimilarLearned,
  getExistingPrice,
  logLearningEvaluation,
} from "./learning-service";
import { enqueueKnowledgeLearning } from "@/lib/knowledge-learning-queue";

export interface LearningResult {
  learned: number;
  rejected: number;
  reasons: string[];
}

export async function runLearningFromHandoff(
  handoffId: string,
  orgId: string,
  excludeIndices?: number[]
): Promise<LearningResult> {
  const reasons: string[] = [];
  let learned = 0;
  let rejected = 0;

  const items = await extractFromHandoff(handoffId, orgId);
  const conversationQuality = 0.75;
  const excludeSet = new Set(excludeIndices ?? []);

  for (let i = 0; i < items.length; i++) {
    if (excludeSet.has(i)) continue;
    const item = items[i]!;

    if (item.type === "qa" && item.question && item.answer) {
      const evalResult = await evaluateQuality(item.question, item.answer);
      let learnedId: string | null = null;
      if (evalResult.decision === "auto_approve") {
        const similar = await findSimilarLearned(orgId, item.answer);
        if ((similar?.score ?? 0) >= 0.85) {
          rejected++;
          reasons.push("qa: duplicate (similar exists)");
          await logLearningEvaluation(orgId, {
            question: item.question,
            answer: item.answer,
            qualityScore: evalResult.score,
            decision: "reject",
            reason: "duplicate (similar exists)",
            handoffId,
          });
          continue;
        }
        try {
          const out = await saveLearnedItem(orgId, item, handoffId);
          learnedId = out.id;
          learned++;
        } catch (err) {
          rejected++;
          reasons.push(`save failed: ${(err as Error)?.message?.slice(0, 50)}`);
        }
      } else if (evalResult.decision === "reject") {
        rejected++;
        reasons.push(`qa: ${evalResult.reason}`);
      }
      await logLearningEvaluation(orgId, {
        question: item.question,
        answer: item.answer,
        qualityScore: evalResult.score,
        decision: evalResult.decision,
        reason: evalResult.reason,
        handoffId,
        learnedId,
      });
      continue;
    }

    if (item.type === "pricing") {
      const similar = await findSimilarLearned(orgId, item.answer ?? item.details ?? "");
      const existingSimilarity = similar?.score;
      let existingPrice: number | null = null;
      if (item.service) {
        existingPrice = await getExistingPrice(orgId, item.service);
      }
      const result = shouldLearn({
        item,
        conversationQuality,
        existingSimilarity,
        existingPrice: existingPrice ?? undefined,
        sourceAgeDays: 0,
      });
      if (!result.ok) {
        rejected++;
        reasons.push(`pricing: ${result.reason}`);
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

/** Trigger learning: excellent = immediate, good = queue */
export async function triggerHandoffLearning(
  handoffId: string,
  orgId: string,
  quality: "excellent" | "good" | "poor",
  excludeIndices?: number[]
): Promise<{ enqueued?: boolean; result?: LearningResult }> {
  if (quality === "poor") return {};

  if (quality === "excellent") {
    const result = await runLearningFromHandoff(handoffId, orgId, excludeIndices);
    return { result };
  }

  const jobId = await enqueueKnowledgeLearning(handoffId, orgId, excludeIndices);
  return { enqueued: !!jobId };
}
