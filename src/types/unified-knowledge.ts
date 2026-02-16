/**
 * Unified AI Knowledge Management — Types
 * Single source of truth: Clinic Override → Global Template → Base
 * Enterprise SaaS, multi-tenant (clinic_id isolation).
 */

/** Platform-controlled service template (read-only for clinics) */
export interface GlobalService {
  id: string;
  name: string;
  standard_description: string;
  compliance_locked: boolean;
  version: number;
  effective_from?: string | null;
  deprecated_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Clinic's service (linked to global or standalone); editable by clinic */
export type ClinicServiceStatus = "active" | "inactive" | "embedding_failed";

export interface ClinicService {
  id: string;
  clinic_id: string;
  global_service_id: string | null;
  custom_title: string;
  custom_highlight: string;
  custom_price: string;
  custom_description: string;
  status: ClinicServiceStatus;
  embedding_version: string;
  template_version_at_embed: number | null;
  last_embedded_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** FAQ status for embedding and soft delete */
export type ClinicFaqStatus = "active" | "inactive" | "embedding_failed";

export interface ClinicServiceCreate {
  clinic_id: string;
  global_service_id?: string | null;
  custom_title: string;
  custom_highlight?: string;
  custom_price?: string;
  custom_description?: string;
  status?: ClinicServiceStatus;
}

export interface ClinicServiceUpdate {
  custom_title?: string;
  custom_highlight?: string;
  custom_price?: string;
  custom_description?: string;
  status?: ClinicServiceStatus;
}

/** Clinic FAQ — editable, inline */
export interface ClinicFaq {
  id: string;
  clinic_id: string;
  question: string;
  answer: string;
  status: ClinicFaqStatus;
  embedding_version: string;
  last_embedded_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicFaqCreate {
  clinic_id: string;
  question: string;
  answer: string;
  status?: ClinicFaqStatus;
}

export interface ClinicFaqUpdate {
  question?: string;
  answer?: string;
  status?: ClinicFaqStatus;
}

/** Status overview for UI cards + AI Health Bar */
export interface UnifiedKnowledgeStatus {
  global: { active: boolean; version: string };
  clinic: {
    active: boolean;
    last_updated: string | null;
    embedding_status: "ok" | "updating" | "failed";
    last_embedding_at: string | null;
    warning_count: number;
  };
  promotions: { active_count: number; expiry_warnings: number };
  platform_managed_mode?: boolean;
  /** AI Status for Health Bar: ready | updating | issue */
  ai_status?: "ready" | "updating" | "issue";
}
