/**
 * AI 7-Agent System — Shared Types
 * Production-ready type definitions
 */

/** Promotion detail for Role Manager — name, summary, endAt, media URLs, price, urgency */
export interface PromotionDetailForAI {
  name: string;
  aiSummary?: string;
  endAt?: string;
  media: string[];
  /** ราคา (บาท) — สำหรับให้ AI กล่าวในแชท */
  price?: string;
  urgency?: boolean;
}

/** ผลลัพธ์จาก Analytics Agent — format เดียวกันทุกตัว */
export interface AnalyticsAgentOutput {
  keyFindings: string[];
  recommendation: string | null;
  riskFlags: string[];
  /** Promotion agent: active promotions with media for Role Manager */
  promotionDetails?: PromotionDetailForAI[];
  /** Finance agent only: 🚨 INTERNAL_FINANCE_ONLY — output guard for customer channel */
  dataClassification?: "INTERNAL_FINANCE_ONLY";
}

/** Context สำหรับ query — ต้อง validate ก่อนใช้ */
export interface AnalyticsContext {
  org_id: string;
  branch_id?: string | null;
  userId?: string | null;
  correlationId?: string;
  /** Enterprise: สำหรับ Vector RAG — Knowledge Agent ใช้ semantic search */
  userMessage?: string | null;
}

/** ผลรวมจาก 6 Analytics Agents — ส่งให้ Role Manager */
export interface AggregatedAnalyticsContext {
  booking: AnalyticsAgentOutput;
  promotion: AnalyticsAgentOutput;
  customer: AnalyticsAgentOutput;
  finance: AnalyticsAgentOutput; // internal only — ห้ามส่งลูกค้า
  knowledge: AnalyticsAgentOutput;
  feedback: AnalyticsAgentOutput;
  /** เวลารวมทั้งหมด (ms) สำหรับ monitoring */
  totalAnalyticsMs: number;
  /** Enterprise: Cross-Agent Reasoning insights */
  _crossAgentInsights?: Array<{ type: string; recommendation: string; confidence: number; keyFindings: string[] }>;
  /** Enterprise: Customer long-term memory summary */
  _customerMemory?: string;
  /** Phase 2 #16: Retrieval confidence 0–1 — ถ้า < 0.75 ใช้ safe fallback */
  _retrievalConfidence?: number;
  /** Phase 2 #16 / Phase 3 #1: true = ห้าม generate detailed medical response */
  _lowConfidence?: boolean;
  /** Phase 3 #1: full | restricted | abstain */
  _retrievalMode?: "full" | "restricted" | "abstain";
  /** Phase 2 #18: global | clinic | merged */
  _knowledgeSource?: string;
  /** Phase 2 #18: version ของ knowledge ที่ใช้ */
  _knowledgeVersion?: number;
  /** Phase 2 #18: quality_score ของ knowledge */
  _knowledgeQualityScore?: number;
  /** Phase 2 #22: category สำหรับ append disclaimer ถ้า surgery */
  _knowledgeCategory?: string;
  /** Phase 2 #20: knowledge ids used for feedback loop */
  _retrievalKnowledgeIds?: string[];
}
