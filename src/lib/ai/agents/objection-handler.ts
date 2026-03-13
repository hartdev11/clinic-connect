/**
 * Objection Handler Agent — Phase 6
 * Role: จัดการข้อกังวล (แพงไป, กลัวปวด, ของไม่แท้)
 * Trigger intent: objection
 * RAG: fetch objection handling tactics from core knowledge
 */
import { searchKnowledgeBrain } from "@/lib/knowledge-brain/vector";
import type { AnalyticsAgentOutput } from "../types";
import type { AnalyticsContext } from "../types";

const AGENT_NAME = "objection-handler";
const TIMEOUT_MS = 200;
const OBJECTION_QUERIES = [
  "แพง คุ้มค่า ราคา justification",
  "กลัวปวด อาการข้างเคียง ความปลอดภัย",
  "ของแท้ ฉีดของจริง มาตรฐาน",
];

export async function runObjectionHandlerAgent(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const start = Date.now();

  try {
    const timeoutPromise = new Promise<AnalyticsAgentOutput>((_, reject) =>
      setTimeout(
        () => reject(new Error("Objection handler timeout")),
        TIMEOUT_MS
      )
    );

    const result = await Promise.race([
      executeObjectionAnalytics(ctx),
      timeoutPromise,
    ]);

    const elapsed = Date.now() - start;
    if (process.env.NODE_ENV === "development") {
      console.log(`[${AGENT_NAME}] completed in ${elapsed}ms`);
    }
    return result;
  } catch (err) {
    const msg = (err as Error)?.message ?? "Unknown error";
    if (process.env.NODE_ENV === "development") {
      console.warn(`[${AGENT_NAME}] error:`, msg.slice(0, 80));
    }
    return {
      keyFindings: [],
      recommendation: null,
      riskFlags: ["OBJECTION_KNOWLEDGE_UNAVAILABLE"],
    };
  }
}

async function executeObjectionAnalytics(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const { org_id, userMessage } = ctx;

  const keyFindings: string[] = [];
  const riskFlags: string[] = [];
  let recommendation: string | null = null;

  const isObjectionIntent =
    userMessage &&
    /แพง|ราคาแพง|คุ้มไหม|กลัว|ปวด|เจ็บ|ของแท้|ของปลอม|ไม่แน่ใจ|ลังเล/i.test(userMessage);

  if (!isObjectionIntent) {
    return {
      keyFindings: ["objection_intent:no"],
      recommendation: null,
      riskFlags: [],
    };
  }

  keyFindings.push("objection_intent:yes");

  try {
    const query = userMessage!.trim().slice(0, 100);
    const hits = await searchKnowledgeBrain(org_id, query, 3);
    for (const h of hits) {
      const content = (h.metadata?.content as string) ?? "";
      const category = (h.metadata?.category as string) ?? "";
      if (content) keyFindings.push(`objection_tactic:${content.slice(0, 120)}`);
      if (category) keyFindings.push(`objection_category:${category}`);
    }
    if (hits.length > 0) {
      recommendation = "OBJECTION_HANDLE_WITH_TACTICS";
    } else {
      for (const q of OBJECTION_QUERIES) {
        const fallback = await searchKnowledgeBrain(org_id, q, 1);
        if (fallback.length > 0) {
          const c = (fallback[0].metadata?.content as string) ?? "";
          if (c) keyFindings.push(`objection_fallback:${c.slice(0, 100)}`);
          break;
        }
      }
      recommendation = recommendation ?? "OBJECTION_EMPATHY_FIRST";
    }
  } catch {
    recommendation = "OBJECTION_EMPATHY_FIRST";
    keyFindings.push("objection_tactic:รับฟังและเข้าใจก่อน ตอบจากความรู้ที่มี");
  }

  return {
    keyFindings: keyFindings.slice(0, 10),
    recommendation,
    riskFlags,
  };
}
