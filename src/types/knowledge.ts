/**
 * E3.3–E3.4 — KnowledgeDocument Schema
 * ใช้กับ Pinecone metadata + Firestore (ถ้าต้องเก็บ structured doc)
 */

export type KnowledgeLevel = "global" | "org" | "branch" | "conversation";

export interface KnowledgeDocument {
  id: string;
  level: KnowledgeLevel;
  org_id?: string | null;
  branch_id?: string | null;
  topic: string;
  category: string;
  key_points: string[];
  text: string;
  expires_at?: string | null;
  is_active: boolean;
  archived_at?: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

/** สำหรับ upsert ลง Pinecone — metadata ที่ filter ได้ */
export interface KnowledgeMetadata {
  level: KnowledgeLevel;
  org_id?: string | null;
  branch_id?: string | null;
  topic: string;
  category: string;
  key_points: string;
  expires_at?: string | null;
  is_active: boolean;
  archived_at?: string | null;
  source: string;
}

/** E5.7–E5.9 — Input สำหรับ Knowledge Input Flow (ไม่มี id, createdAt, updatedAt) */
export interface KnowledgeDocumentCreate {
  level: KnowledgeLevel;
  org_id?: string | null;
  branch_id?: string | null;
  topic: string;
  category: string;
  key_points: string[];
  text: string;
  expires_at?: string | null;
  is_active: boolean;
  archived_at?: string | null;
  source: string;
}

/** E5.7 — Duplicate detection result */
export type DuplicateType = "exact" | "semantic";

export interface DuplicateResult {
  type: DuplicateType;
  existing: KnowledgeDocument;
  score?: number; // semantic similarity (0–1)
}

/** E5.7 — Conflict resolution action */
export type ConflictResolution = "replace" | "keep" | "cancel";

// --- Knowledge Topics + Versions (Enterprise Redesign) ---

export const KNOWLEDGE_DATA_CLASSIFICATION = "CLINIC_PUBLIC_KNOWLEDGE" as const;

/** Category for knowledge input page (no promotion) */
export type KnowledgeTopicCategory = "service" | "price" | "faq";

/** Version status for async embedding flow */
export type KnowledgeVersionStatus = "draft" | "updating" | "active" | "archived" | "failed";

export interface KnowledgeVersionPayload {
  topic: string;
  category: KnowledgeTopicCategory;
  summary: string[];
  content: string;
  exampleQuestions: string[];
}

export interface KnowledgeVersion {
  id: string;
  orgId: string;
  topicId: string;
  topic: string;
  category: KnowledgeTopicCategory;
  summary: string[];
  content: string;
  exampleQuestions: string[];
  createdBy: string;
  createdAt: string;
  status: KnowledgeVersionStatus;
  dataClassification: typeof KNOWLEDGE_DATA_CLASSIFICATION;
}

export interface KnowledgeTopic {
  id: string;
  orgId: string;
  topic: string;
  category: KnowledgeTopicCategory;
  activeVersionId: string | null;
  updatedAt: string;
  updatedBy: string;
}

/** Stale detection: computed at read time from updatedAt */
export type KnowledgeStaleStatus = "fresh" | "aging" | "stale";

/** For list view: topic + latest version preview */
export interface KnowledgeTopicListItem {
  id: string;
  topic: string;
  category: KnowledgeTopicCategory;
  preview: string;
  lastUpdated: string;
  updatedBy: string;
  status: KnowledgeVersionStatus;
  activeVersionId: string | null;
  /** Computed at read: fresh (<90d), aging (90–120d), stale (>120d) */
  staleStatus?: KnowledgeStaleStatus;
}

export type KnowledgeChangeAction = "created" | "updated" | "rolled_back" | "deleted";

export interface KnowledgeChangeLogEntry {
  id: string;
  orgId: string;
  topicId: string;
  topic: string;
  action: KnowledgeChangeAction;
  userId: string;
  createdAt: string;
}
