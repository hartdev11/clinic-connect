/**
 * E5.7–E5.9 — Knowledge Input Flow
 * Structured Input → Duplicate Detection → Conflict Resolution → Save → Embed → Vector DB
 */
import type {
  KnowledgeDocument,
  KnowledgeDocumentCreate,
  DuplicateResult,
  ConflictResolution,
} from "@/types/knowledge";
import {
  findKnowledgeByExactText,
  createKnowledgeDoc,
  updateKnowledgeDoc,
  getKnowledgeDocById,
} from "@/lib/knowledge-data";
import { searchKnowledge, upsertKnowledgeDoc } from "@/lib/knowledge-vector";
import { invalidateAICache } from "@/lib/ai/ai-feedback-loop";

const SEMANTIC_THRESHOLD = 0.85;

/** E5.7 — Duplicate Detection: exact match → warn; semantic > 0.85 → Replace/Keep/Cancel */
export async function detectDuplicates(
  input: KnowledgeDocumentCreate,
  opts?: { org_id?: string | null; branch_id?: string | null }
): Promise<DuplicateResult | null> {
  const normalizedText = input.text.trim().replace(/\s+/g, " ");

  // 1. Exact match
  const exact = await findKnowledgeByExactText(normalizedText, {
    org_id: input.org_id ?? opts?.org_id,
    branch_id: input.branch_id ?? opts?.branch_id,
  });
  if (exact) {
    return { type: "exact", existing: exact };
  }

  // 2. Semantic similarity
  const filters: { org_id?: string; branch_id?: string } = {};
  if (input.org_id) filters.org_id = input.org_id;
  if (input.branch_id) filters.branch_id = input.branch_id;

  const results = await searchKnowledge(input.text, filters, 5);
  const semantic = results.find((r) => (r.score ?? 0) >= SEMANTIC_THRESHOLD);
  if (!semantic || !semantic.id) return null;

  const existing = await getKnowledgeDocById(semantic.id);
  if (!existing) return null;

  return {
    type: "semantic",
    existing,
    score: semantic.score ?? 0,
  };
}

/** E5.7–E5.9 — Process Knowledge Input: Save → Embed → Vector DB */
export async function processKnowledgeInput(
  input: KnowledgeDocumentCreate,
  opts?: {
    org_id?: string | null;
    branch_id?: string | null;
    conflictResolution?: ConflictResolution;
    duplicate?: DuplicateResult | null;
  }
): Promise<{
  status: "saved" | "replaced" | "kept" | "cancelled" | "needs_resolution";
  id?: string;
  duplicate?: DuplicateResult;
}> {
  const { conflictResolution, duplicate } = opts ?? {};

  // Detect duplicates ถ้ายังไม่ตรวจ
  const dup = duplicate ?? (await detectDuplicates(input, opts));
  if (dup) {
    if (!conflictResolution) {
      return { status: "needs_resolution", duplicate: dup };
    }
    if (conflictResolution === "cancel") {
      return { status: "cancelled", duplicate: dup };
    }
    if (conflictResolution === "keep") {
      return { status: "kept", id: dup.existing.id, duplicate: dup };
    }
    // replace
    const fullDoc: KnowledgeDocument = {
      ...dup.existing,
      ...input,
      id: dup.existing.id,
      text: input.text.trim().replace(/\s+/g, " "),
      createdAt: dup.existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await updateKnowledgeDoc(dup.existing.id, input);
    await upsertKnowledgeDoc(fullDoc);
    const orgId = fullDoc.org_id ?? opts?.org_id;
    if (orgId) void invalidateAICache({ org_id: orgId, scope: "knowledge" });
    return { status: "replaced", id: dup.existing.id, duplicate: dup };
  }

  // No duplicate — create new
  const id = await createKnowledgeDoc(input);
  const now = new Date().toISOString();
  const fullDoc: KnowledgeDocument = {
    id,
    ...input,
    text: input.text.trim().replace(/\s+/g, " "),
    createdAt: now,
    updatedAt: now,
  };
  await upsertKnowledgeDoc(fullDoc);
  const orgId = fullDoc.org_id ?? opts?.org_id;
  if (orgId) void invalidateAICache({ org_id: orgId, scope: "knowledge" });
  return { status: "saved", id };
}
