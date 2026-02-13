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
