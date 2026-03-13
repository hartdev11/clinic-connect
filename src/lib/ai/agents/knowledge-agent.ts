/**
 * Knowledge Analytics Agent
 * Enterprise: Vector RAG (Pinecone semantic search) + Firestore fallback
 * Phase 2 #16: Retrieval confidence layer, low_confidence flag, abstain strategy
 */
import { listKnowledgeDocsForOrg } from "@/lib/knowledge-data";
import { expandRagQueryForBodyPart } from "@/lib/knowledge-retrieval";
import {
  searchKnowledgeWithPyramid,
  type KnowledgeSearchContext,
} from "@/lib/knowledge-vector";
import type { AnalyticsAgentOutput } from "../types";
import type { AnalyticsContext } from "../types";

const AGENT_NAME = "knowledge-agent";
/** Phase 3 #15: Retrieval <150ms target */
const TIMEOUT_MS = 150;
const RAG_TOP_K = 5;
/** Phase 14: Threshold for "good" RAG results — below this we try fallbacks */
const RAG_THRESHOLD = 0.7;

/** Build structured context from RAG hit metadata — for Role Manager / anti-hallucination */
function buildStructuredFromMetadata(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {};
  const risksStr = meta.risks as string | undefined;
  const contraStr = meta.contraindications as string | undefined;
  const risks = typeof risksStr === "string" ? risksStr.split(";").map((s) => s.trim()).filter(Boolean) : [];
  const contraindications = typeof contraStr === "string" ? contraStr.split(";").map((s) => s.trim()).filter(Boolean) : [];
  return {
    service_name: String(meta.service_name ?? ""),
    category: String(meta.category ?? ""),
    suitable_for: [],
    not_suitable_for: [],
    risks: risks.length > 0 ? risks : ["กรุณาปรึกษาแพทย์ก่อน"],
    contraindications: contraindications.length > 0 ? contraindications : ["กรุณาปรึกษาแพทย์ก่อน"],
    disclaimer: "ข้อมูลนี้เป็นข้อมูลทั่วไป กรุณาปรึกษาแพทย์หรือผู้เชี่ยวชาญก่อนตัดสินใจค่ะ",
    price_range: meta.price_range ? String(meta.price_range) : null,
    content: String(meta.content ?? ""),
  };
}

export interface KnowledgeAgentExtendedOutput extends AnalyticsAgentOutput {
  _retrievalConfidence?: number;
  _lowConfidence?: boolean;
  _retrievalMode?: "full" | "restricted" | "abstain";
  _knowledgeSource?: string;
  _knowledgeVersion?: number;
  _knowledgeQualityScore?: number;
  _knowledgeCategory?: string;
  _retrievalKnowledgeIds?: string[];
}

export async function runKnowledgeAgent(
  ctx: AnalyticsContext
): Promise<KnowledgeAgentExtendedOutput> {
  const start = Date.now();

  try {
    const timeoutPromise = new Promise<AnalyticsAgentOutput>((_, reject) =>
      setTimeout(() => reject(new Error("Knowledge agent timeout")), TIMEOUT_MS)
    );

    const result = await Promise.race([
      executeKnowledgeAnalytics(ctx),
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
      riskFlags: ["KNOWLEDGE_DATA_UNAVAILABLE"],
    };
  }
}

async function executeKnowledgeAnalytics(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const { org_id, branch_id, userMessage } = ctx;

  const keyFindings: string[] = [];
  const riskFlags: string[] = [];
  let recommendation: string | null = null;

  const useVectorRAG = Boolean(userMessage?.trim() && org_id);

  let retrievalConfidence = 0;
  let knowledgeSource: string | undefined;
  let knowledgeVersion: number | undefined;
  let knowledgeQualityScore: number | undefined;
  let knowledgeCategory: string | undefined;
  let retrievalKnowledgeIds: string[] = [];
  let _structuredKnowledge: Record<string, unknown> | null = null;

  if (useVectorRAG && org_id) {
    try {
      const {
        searchKnowledgeBrain,
      } = await import("@/lib/knowledge-brain/vector");
      const {
        computeRetrievalConfidenceWeighted,
        getRetrievalMode,
        isAbstainRequired,
      } = await import("@/lib/knowledge-brain/retrieval-intelligence");

      const ragQuery = expandRagQueryForBodyPart(userMessage!.trim());
      let kbResults = await searchKnowledgeBrain(org_id, ragQuery, RAG_TOP_K);
      const { reRankKnowledgeHits } = await import("@/lib/knowledge-brain/retrieval-intelligence");
      kbResults = reRankKnowledgeHits(kbResults, userMessage!.trim());
      const top = kbResults[0];
      const qualityFromMeta = top?.metadata?.quality_score as number | undefined;
      retrievalConfidence = computeRetrievalConfidenceWeighted(kbResults, {
        fieldCompleteness: 0.85,
        knowledgeQualityScore: typeof qualityFromMeta === "number" ? qualityFromMeta : 70,
      });

      knowledgeSource = top?.knowledge_source ?? (kbResults.length > 0 ? "merged" : undefined);
      knowledgeVersion = top?.knowledge_version;
      knowledgeCategory = top?.metadata?.category as string | undefined;
      knowledgeQualityScore = qualityFromMeta;
      retrievalKnowledgeIds = kbResults.map((r) => r.id.replace(/^(clinic_|global_)/, ""));

      const goodKbResults = kbResults.filter((r) => (typeof r.score === "number" ? r.score : 0) >= RAG_THRESHOLD);

      if (goodKbResults.length > 0) {
        const topGood = goodKbResults[0];
        for (const r of goodKbResults) {
          const sn = (r.metadata?.service_name as string) ?? "";
          const cat = (r.metadata?.category as string) ?? "";
          const content = (r.metadata?.content as string) ?? "";
          if (sn) keyFindings.push(`kb_service:${sn}`);
          if (cat) keyFindings.push(`kb_category:${cat}`);
          if (content) keyFindings.push(`rag_snippet:${content.slice(0, 150)}`);
        }
        const unique = [...new Set(keyFindings)];
        keyFindings.length = 0;
        keyFindings.push(...unique.slice(0, 15));
        recommendation = goodKbResults.length >= 2 ? "KB_RAG_MATCH" : "KB_RAG_SINGLE";
        if (isAbstainRequired(getRetrievalMode(retrievalConfidence))) {
          riskFlags.push("RAG_ABSTAIN_REQUIRED");
        }
        _structuredKnowledge = topGood ? buildStructuredFromMetadata(topGood.metadata) : null;
      }
    } catch (err) {
      const { isFailsafeError } = await import("@/lib/knowledge-brain/failsafe");
      if (isFailsafeError(err)) riskFlags.push("RAG_FAILSAFE");
    }
  }

  if (useVectorRAG && keyFindings.length === 0 && org_id) {
    try {
      const { retrieveKnowledgeContext } = await import("@/lib/knowledge-retrieval");
      const ragResults = await retrieveKnowledgeContext(org_id, userMessage!.trim());
      const goodTopicResults = ragResults.filter((r) => (r.finalScore ?? r.score ?? 0) >= RAG_THRESHOLD);

      if (goodTopicResults.length > 0) {
        for (const r of goodTopicResults) {
          const topic = (r.metadata?.topic as string) ?? "";
          const category = (r.metadata?.category as string) ?? "";
          const content = (r.metadata?.content as string) ?? "";
          if (topic) keyFindings.push(`topic:${topic}`);
          if (category) keyFindings.push(`category:${category}`);
          if (content) keyFindings.push(`rag_snippet:${content.slice(0, 150)}`);
        }
        const unique = [...new Set(keyFindings)];
        keyFindings.length = 0;
        keyFindings.push(...unique.slice(0, 15));
        recommendation = goodTopicResults.length >= 2 ? "RAG_MATCH" : "RAG_SINGLE";
      }
    } catch {
      // fallthrough to global
    }

    if (keyFindings.length === 0) {
      try {
        const globalCtx: KnowledgeSearchContext = { level: "global" };
        const globalResults = await searchKnowledgeWithPyramid(
          userMessage!.trim(),
          globalCtx,
          { topK: RAG_TOP_K, is_active: true }
        );
        const goodGlobal = globalResults.filter((r) => {
          const s = r.score;
          return typeof s === "number" && s >= RAG_THRESHOLD;
        });
        if (goodGlobal.length > 0) {
          for (const r of goodGlobal) {
            const topic = (r.metadata?.topic as string) ?? "";
            const category = (r.metadata?.category as string) ?? "";
            const content = (r.metadata?.content as string) ?? "";
            if (topic) keyFindings.push(`topic:${topic}`);
            if (category) keyFindings.push(`category:${category}`);
            if (content) keyFindings.push(`rag_snippet:${content.slice(0, 150)}`);
          }
          const unique = [...new Set(keyFindings)];
          keyFindings.length = 0;
          keyFindings.push(...unique.slice(0, 15));
          recommendation = goodGlobal.length >= 2 ? "RAG_MATCH" : "RAG_SINGLE";
        }
      } catch {
        riskFlags.push("RAG_UNAVAILABLE");
      }
    }

    if (keyFindings.length === 0) {
      riskFlags.push("RAG_EMPTY");
      const { logKnowledgeGap } = await import("@/lib/knowledge-gap-logger");
      void logKnowledgeGap(org_id, userMessage!.trim());
    }
  }

  const docs = await listKnowledgeDocsForOrg(org_id, {
    branchId: branch_id,
    limit: 25,
  });

  const topics = [...new Set(docs.map((d) => d.topic).filter(Boolean))];
  const categories = [...new Set(docs.map((d) => d.category).filter(Boolean))];

  for (const t of topics.slice(0, 10)) {
    if (!keyFindings.includes(`topic:${t}`)) keyFindings.push(`topic:${t}`);
  }
  for (const c of categories.slice(0, 5)) {
    if (!keyFindings.includes(`category:${c}`)) keyFindings.push(`category:${c}`);
  }

  if (docs.length === 0 && keyFindings.length === 0) {
    riskFlags.push("EMPTY_KNOWLEDGE_BASE");
    recommendation = recommendation ?? "NO_KB_DATA";
  } else if (!recommendation) {
    recommendation = topics.length >= 3 ? "RICH_KB" : "LIMITED_KB";
  }

  const retrievalMode = retrievalConfidence > 0
    ? (await import("@/lib/knowledge-brain/retrieval-intelligence")).getRetrievalMode(retrievalConfidence)
    : "abstain" as const;
  const lowConfidence = retrievalMode === "abstain" || retrievalMode === "restricted";

  const output: KnowledgeAgentExtendedOutput = {
    keyFindings: keyFindings.slice(0, 20),
    recommendation,
    riskFlags,
    _retrievalConfidence: retrievalConfidence,
    _lowConfidence: lowConfidence,
    _retrievalMode: retrievalMode,
    _knowledgeSource: knowledgeSource,
    _knowledgeVersion: knowledgeVersion,
    _knowledgeQualityScore: knowledgeQualityScore,
    _knowledgeCategory: knowledgeCategory,
    _retrievalKnowledgeIds: retrievalKnowledgeIds,
    ...(_structuredKnowledge ? _structuredKnowledge : {}),
  };
  return output;
}
