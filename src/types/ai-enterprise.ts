/**
 * Enterprise AI — Shared Types
 * Customer Memory, Prompt Registry, Observability, Governance
 */

// ─── 1. Customer Long-Term Memory ─────────────────────────────────────────
export interface CustomerMemory {
  id: string;
  org_id: string;
  user_id: string; // LINE userId or externalId
  /** Chat summary — ลด token, ป้องกัน overflow */
  summary: string;
  /** Preferences: โปรที่สนใจ, ราคาแพงไม่เอา, ชอบโปรฉีดหน้า */
  preferences: CustomerPreference;
  /** Booking pattern: มาบ่อย, ชอบนัดเช้า ฯลฯ */
  booking_pattern: BookingPattern;
  /** Sentiment trend: positive, neutral, negative */
  sentiment_trend: string;
  /** Message count — trigger summarization ทุก X ข้อความ */
  message_count: number;
  last_summarized_at: string; // ISO
  updated_at: string;
}

export interface CustomerPreference {
  interested_promos?: string[];
  price_sensitivity?: "low" | "medium" | "high";
  preferred_services?: string[];
  preferred_times?: string[];
  dislikes?: string[];
}

export interface BookingPattern {
  frequency?: "rare" | "occasional" | "regular";
  preferred_days?: string[];
  last_booking_at?: string;
}

// ─── 2. Prompt Versioning ──────────────────────────────────────────────────
export interface PromptVersion {
  id: string;
  key: string; // "role-manager" | "chat-agent" | ...
  version: string; // "1.2.3"
  content: string;
  is_active: boolean;
  created_at: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
}

// ─── 3. AI Observability ───────────────────────────────────────────────────
export interface AIActivityLog {
  id: string;
  org_id: string;
  correlation_id: string;
  prompt_version: string;
  model_version: string;
  tokens_used: { prompt: number; completion: number; total: number };
  context_size_chars?: number;
  agents_triggered?: string[];
  latency_per_agent_ms?: Record<string, number>;
  total_latency_ms: number;
  /** Evaluation scores */
  hallucination_score?: number;
  policy_violation_detected?: boolean;
  self_consistency_check?: boolean;
  created_at: string;
}

// ─── 4. Pre-LLM Safety Classification ─────────────────────────────────────
export type SafetyClassification =
  | "safe"
  | "medical_intent"
  | "legal_intent"
  | "financial_sensitive"
  | "abusive"
  | "block";

export interface PreLLMSafetyResult {
  classification: SafetyClassification;
  block: boolean;
  escalate: boolean;
  suggested_action?: "block" | "escalate" | "proceed";
  reason?: string;
}

// ─── 5. Cost Governance ─────────────────────────────────────────────────────
export interface OrgAIBudget {
  org_id: string;
  monthly_budget_baht: number;
  daily_budget_baht: number;
  hard_stop_enabled: boolean;
  alert_threshold_percent: number;
  model_downgrade_enabled: boolean;
  /** เมื่อถึง threshold จะใช้ model ถัดไปที่ถูกกว่า */
  fallback_model?: string;
  updated_at: string;
}

// ─── 6. AI Evaluation Golden Dataset ───────────────────────────────────────
export interface GoldenTestCase {
  id: string;
  input: string;
  expected_output_contains?: string[];
  expected_output_not_contains?: string[];
  expected_intent?: string;
  tags?: string[];
}
