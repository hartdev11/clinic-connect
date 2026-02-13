/**
 * AI Observability — Enterprise Grade
 * Activity log: prompt version, model, tokens, agents, latency, evaluation
 */
import { db } from "@/lib/firebase-admin";
import type { AIActivityLog } from "@/types/ai-enterprise";

const COLLECTION = "ai_activity_logs";
const RETENTION_DAYS = 30;

export interface LogAIActivityInput {
  org_id: string;
  correlation_id: string;
  prompt_version?: string;
  model_version?: string;
  tokens_used?: { prompt: number; completion: number; total: number };
  context_size_chars?: number;
  agents_triggered?: string[];
  latency_per_agent_ms?: Record<string, number>;
  total_latency_ms: number;
  hallucination_score?: number;
  policy_violation_detected?: boolean;
  hallucination_detected?: boolean;
  self_consistency_check?: boolean;
  /** Phase 2 #18: AI Observability Expansion */
  retrieval_confidence?: number;
  knowledge_source?: string;
  knowledge_version?: number;
  quality_score?: number;
  hallucination_flag?: boolean;
  response_confidence?: number;
  /** Phase 2 #20: For self-improving feedback - knowledge ids used in retrieval */
  retrieval_knowledge_ids?: string[];
  /** Phase 3 #1: full | restricted | abstain */
  retrieval_mode?: string;
  /** Phase 3 #9: Incident traceability (alias for existing fields) */
  knowledge_version_used?: number;
  similarity_score?: number;
  confidence_level?: number;
  /** Phase 3 #7: Cost control */
  retrieval_cost_estimate?: number;
  generation_cost_estimate?: number;
  /** Phase 3 #15: Performance SLO breach (total >800ms, retrieval >150ms) */
  performance_breach?: boolean;
  /** World-class: A/B prompt variant สำหรับวัดผล */
  prompt_variant?: string;
}

/** บันทึก AI activity — fire-and-forget */
export async function logAIActivity(input: LogAIActivityInput): Promise<void> {
  try {
    await db.collection(COLLECTION).add({
      org_id: input.org_id,
      correlation_id: input.correlation_id,
      prompt_version: input.prompt_version ?? "0.0.0-default",
      model_version: input.model_version ?? "gpt-4o-mini",
      tokens_used: input.tokens_used ?? { prompt: 0, completion: 0, total: 0 },
      context_size_chars: input.context_size_chars,
      agents_triggered: input.agents_triggered ?? [],
      latency_per_agent_ms: input.latency_per_agent_ms ?? {},
      total_latency_ms: input.total_latency_ms,
      hallucination_score: input.hallucination_score,
      policy_violation_detected: input.policy_violation_detected ?? false,
      hallucination_detected: input.hallucination_detected ?? false,
      self_consistency_check: input.self_consistency_check,
      retrieval_confidence: input.retrieval_confidence,
      knowledge_source: input.knowledge_source,
      knowledge_version: input.knowledge_version,
      quality_score: input.quality_score,
      hallucination_flag: input.hallucination_flag ?? input.hallucination_detected ?? false,
      response_confidence: input.response_confidence,
      retrieval_knowledge_ids: input.retrieval_knowledge_ids,
      retrieval_mode: input.retrieval_mode,
      knowledge_version_used: input.knowledge_version_used,
      similarity_score: input.similarity_score,
      confidence_level: input.confidence_level,
      retrieval_cost_estimate: input.retrieval_cost_estimate,
      generation_cost_estimate: input.generation_cost_estimate,
      performance_breach: input.performance_breach ?? false,
      prompt_variant: input.prompt_variant ?? null,
      created_at: new Date(),
    });
  } catch (err) {
    console.warn("[AI Observability] Log failed:", (err as Error)?.message?.slice(0, 80));
  }
}

/** Policy violation check — rule-based หลังได้ reply */
export function checkPolicyViolation(reply: string): boolean {
  const forbidden = [
    /รายได้.*บาท|ยอดขาย.*บาท|revenue|กำไร.*บาท/i,
    /วินิจฉัยว่า|diagnos.*as|เป็นโรค/i,
    /รับประกัน.*ผล|100%\s*ปลอดภัย/i,
  ];
  return forbidden.some((p) => p.test(reply));
}

/** Self-consistency — ตรวจว่า reply สอดคล้องกับ context (rule-based validation) */
export { selfConsistencyCheck } from "./answer-constraint-engine";
