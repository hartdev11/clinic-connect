/**
 * Enterprise Knowledge Brain — Types
 * Multi-tenant, 1000+ clinics
 */

export interface GlobalKnowledge {
  id: string;
  category: string;
  service_name: string;
  description: string;
  suitable_for: string[];
  not_suitable_for: string[];
  procedure_steps: string[];
  recovery_time: string;
  results_timeline: string;
  risks: string[];
  contraindications: string[];
  default_FAQ: string[];
  version: number;
  approved: boolean;
  last_updated: string; // ISO
  disclaimer?: string | null;
}

export type ClinicKnowledgeStatus = "draft" | "pending_review" | "approved" | "needs_review";

export type KnowledgeQualityGrade = "A" | "B" | "C" | "D";

export interface ClinicKnowledge {
  id: string;
  org_id: string;
  base_service_id: string; // reference to global_knowledge.id
  custom_brand?: string | null;
  custom_price_range?: string | null;
  custom_differentiator?: string | null;
  custom_notes?: string | null;
  branch_specific?: string | null;
  status: ClinicKnowledgeStatus;
  version: number;
  updated_at: string; // ISO
  updated_by?: string | null;
  /** Phase 2: Quality scoring */
  knowledge_quality_score?: number | null;
  knowledge_quality_grade?: KnowledgeQualityGrade | null;
  /** Phase 2: Duplicate detection */
  duplicate_of?: string | null;
  similarity_score?: number | null;
  /** Phase 2: Drift monitoring */
  last_reviewed_at?: string | null; // ISO
  expiry_policy_days?: number | null;
  /** Phase 2: Safety */
  disclaimer?: string | null;
  /** Phase 2: Self-improving feedback */
  failure_count?: number;
  last_failure_at?: string | null; // ISO
  /** Phase 3 #3: AI quality review */
  ai_review_score?: number | null;
  ai_review_notes?: string | null;
  /** Phase 3 #5: Compliance override */
  compliance_override_active?: boolean | null;
}

export interface GlobalPolicyRule {
  id: string;
  prohibited_phrases: string[];
  risky_claim_patterns: (string | RegExp)[];
  medical_claim_rules: (string | RegExp)[];
  mandatory_disclaimer?: string | null;
  disabled_services?: string[]; // Emergency Global Revoke
  updated_at: string;
}

export interface ClinicKnowledgeCreate {
  org_id: string;
  base_service_id: string;
  custom_brand?: string | null;
  custom_price_range?: string | null;
  custom_differentiator?: string | null;
  custom_notes?: string | null;
  branch_specific?: string | null;
  status?: ClinicKnowledgeStatus;
  /** Phase 2 */
  expiry_policy_days?: number | null;
  disclaimer?: string | null;
}

export interface ClinicKnowledgeUpdate {
  /** Phase 3 #3 */
  ai_review_score?: number | null;
  ai_review_notes?: string | null;
  custom_brand?: string | null;
  custom_price_range?: string | null;
  custom_differentiator?: string | null;
  custom_notes?: string | null;
  branch_specific?: string | null;
  status?: ClinicKnowledgeStatus;
  /** Phase 2: Quality, drift, duplicate */
  knowledge_quality_score?: number | null;
  knowledge_quality_grade?: KnowledgeQualityGrade | null;
  duplicate_of?: string | null;
  similarity_score?: number | null;
  last_reviewed_at?: string | null;
  expiry_policy_days?: number | null;
  disclaimer?: string | null;
}

export interface KnowledgeVersionSnapshot {
  knowledge_id: string;
  org_id: string;
  version_number: number;
  snapshot: Record<string, unknown>;
  updated_by?: string | null;
  timestamp: string; // ISO
}

export interface StructuredKnowledgeContext {
  service_name: string;
  category: string;
  suitable_for: string[];
  not_suitable_for: string[];
  risks: string[];
  contraindications?: string[];
  clinic_brand?: string | null;
  price_range?: string | null;
  differentiator?: string | null;
  last_updated: string;
}

export interface ValidationError {
  field: string;
  message: string;
}
