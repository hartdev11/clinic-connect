/**
 * Enterprise Knowledge Brain — Data Layer
 * global_knowledge, clinic_knowledge, knowledge_versions
 */
import { db } from "@/lib/firebase-admin";
import type {
  GlobalKnowledge,
  ClinicKnowledge,
  ClinicKnowledgeCreate,
  ClinicKnowledgeUpdate,
  KnowledgeVersionSnapshot,
  ClinicKnowledgeStatus,
  KnowledgeQualityGrade,
} from "@/types/knowledge-brain";

const COL_GLOBAL = "global_knowledge";
const COL_CLINIC = "clinic_knowledge";
const COL_VERSIONS = "knowledge_versions";

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  return [];
}

// ─── Global Knowledge ──────────────────────────────────────────────────────

export async function listGlobalKnowledge(limit = 100): Promise<GlobalKnowledge[]> {
  const snap = await db
    .collection(COL_GLOBAL)
    .where("approved", "==", true)
    .orderBy("service_name", "asc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      category: d.category ?? "",
      service_name: d.service_name ?? "",
      description: d.description ?? "",
      suitable_for: toArray(d.suitable_for),
      not_suitable_for: toArray(d.not_suitable_for),
      procedure_steps: toArray(d.procedure_steps),
      recovery_time: d.recovery_time ?? "",
      results_timeline: d.results_timeline ?? "",
      risks: toArray(d.risks),
      contraindications: toArray(d.contraindications),
      default_FAQ: toArray(d.default_FAQ),
      version: d.version ?? 1,
      approved: d.approved ?? false,
      last_updated: toISO(d.last_updated),
    };
  });
}

export async function getGlobalKnowledgeById(id: string): Promise<GlobalKnowledge | null> {
  const doc = await db.collection(COL_GLOBAL).doc(id).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    id: doc.id,
    category: d.category ?? "",
    service_name: d.service_name ?? "",
    description: d.description ?? "",
    suitable_for: toArray(d.suitable_for),
    not_suitable_for: toArray(d.not_suitable_for),
    procedure_steps: toArray(d.procedure_steps),
    recovery_time: d.recovery_time ?? "",
    results_timeline: d.results_timeline ?? "",
    risks: toArray(d.risks),
    contraindications: toArray(d.contraindications),
    default_FAQ: toArray(d.default_FAQ),
    version: d.version ?? 1,
    approved: d.approved ?? false,
    last_updated: toISO(d.last_updated),
  };
}

// ─── Clinic Knowledge ─────────────────────────────────────────────────────

export async function listClinicKnowledge(
  orgId: string,
  opts?: { status?: ClinicKnowledgeStatus; limit?: number }
): Promise<ClinicKnowledge[]> {
  const limit = Math.min(opts?.limit ?? 100, 200);
  let q = db.collection(COL_CLINIC).where("org_id", "==", orgId);
  if (opts?.status) q = q.where("status", "==", opts.status) as typeof q;
  q = q.orderBy("updated_at", "desc").limit(limit) as typeof q;

  const snap = await q.get();
  return snap.docs.map((doc) => mapClinicDoc(doc));
}

function mapClinicDoc(
  doc: { id: string; data: () => Record<string, unknown> | undefined }
): ClinicKnowledge {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    org_id: String(d.org_id ?? ""),
    base_service_id: String(d.base_service_id ?? ""),
    custom_brand: (d.custom_brand as string | null) ?? null,
    custom_price_range: (d.custom_price_range as string | null) ?? null,
    custom_differentiator: (d.custom_differentiator as string | null) ?? null,
    custom_notes: (d.custom_notes as string | null) ?? null,
    branch_specific: (d.branch_specific as string | null) ?? null,
    status: (d.status as ClinicKnowledgeStatus) ?? "draft",
    version: Number(d.version ?? 1),
    updated_at: toISO(d.updated_at),
    updated_by: (d.updated_by as string | null) ?? null,
    knowledge_quality_score: typeof d.knowledge_quality_score === "number" ? d.knowledge_quality_score : null,
    knowledge_quality_grade: (d.knowledge_quality_grade as KnowledgeQualityGrade) ?? null,
    duplicate_of: (d.duplicate_of as string | null) ?? null,
    similarity_score: typeof d.similarity_score === "number" ? d.similarity_score : null,
    last_reviewed_at: d.last_reviewed_at ? toISO(d.last_reviewed_at) : null,
    expiry_policy_days: typeof d.expiry_policy_days === "number" ? d.expiry_policy_days : null,
    disclaimer: (d.disclaimer as string | null) ?? null,
    failure_count: typeof d.failure_count === "number" ? d.failure_count : undefined,
    last_failure_at: d.last_failure_at ? toISO(d.last_failure_at) : null,
    ai_review_score: typeof d.ai_review_score === "number" ? d.ai_review_score : null,
    ai_review_notes: (d.ai_review_notes as string | null) ?? null,
    compliance_override_active:
      typeof d.compliance_override_active === "boolean"
        ? d.compliance_override_active
        : null,
  };
}

export async function getClinicKnowledgeById(id: string, orgId: string): Promise<ClinicKnowledge | null> {
  const doc = await db.collection(COL_CLINIC).doc(id).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  if (d.org_id !== orgId) return null;
  return mapClinicDoc(doc);
}

export async function createClinicKnowledge(
  data: ClinicKnowledgeCreate,
  userId?: string | null
): Promise<string> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const now = new Date().toISOString();
  const doc = await db.collection(COL_CLINIC).add({
    org_id: data.org_id,
    base_service_id: data.base_service_id,
    custom_brand: data.custom_brand ?? null,
    custom_price_range: data.custom_price_range ?? null,
    custom_differentiator: data.custom_differentiator ?? null,
    custom_notes: data.custom_notes ?? null,
    branch_specific: data.branch_specific ?? null,
    status: data.status ?? "draft",
    version: 1,
    updated_at: now,
    updated_by: userId ?? null,
    expiry_policy_days: typeof data.expiry_policy_days === "number" ? data.expiry_policy_days : 180,
    disclaimer: data.disclaimer ?? null,
  });
  return doc.id;
}

export async function updateClinicKnowledge(
  id: string,
  orgId: string,
  data: ClinicKnowledgeUpdate,
  userId?: string | null
): Promise<boolean> {
  const docRef = db.collection(COL_CLINIC).doc(id);
  const doc = await docRef.get();
  if (!doc.exists) return false;
  const d = doc.data()!;
  if (d.org_id !== orgId) return false;

  const current = d.version ?? 1;
  const update: Record<string, unknown> = {
    version: current + 1,
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
  };
  if (data.custom_brand !== undefined) update.custom_brand = data.custom_brand;
  if (data.custom_price_range !== undefined) update.custom_price_range = data.custom_price_range;
  if (data.custom_differentiator !== undefined) update.custom_differentiator = data.custom_differentiator;
  if (data.custom_notes !== undefined) update.custom_notes = data.custom_notes;
  if (data.branch_specific !== undefined) update.branch_specific = data.branch_specific;
  if (data.status !== undefined) update.status = data.status;
  if (data.ai_review_score !== undefined) update.ai_review_score = data.ai_review_score;
  if (data.ai_review_notes !== undefined) update.ai_review_notes = data.ai_review_notes;
  if (data.knowledge_quality_score !== undefined) update.knowledge_quality_score = data.knowledge_quality_score;
  if (data.knowledge_quality_grade !== undefined) update.knowledge_quality_grade = data.knowledge_quality_grade;
  if (data.duplicate_of !== undefined) update.duplicate_of = data.duplicate_of;
  if (data.similarity_score !== undefined) update.similarity_score = data.similarity_score;
  if (data.last_reviewed_at !== undefined) update.last_reviewed_at = data.last_reviewed_at;
  if (data.expiry_policy_days !== undefined) update.expiry_policy_days = data.expiry_policy_days;
  if (data.disclaimer !== undefined) update.disclaimer = data.disclaimer;

  await docRef.update(update);
  return true;
}

// ─── Version Control ─────────────────────────────────────────────────────

export async function saveKnowledgeVersionSnapshot(
  knowledgeId: string,
  orgId: string,
  versionNumber: number,
  snapshot: Record<string, unknown>,
  userId?: string | null
): Promise<void> {
  await db.collection(COL_VERSIONS).add({
    knowledge_id: knowledgeId,
    org_id: orgId,
    version_number: versionNumber,
    snapshot,
    updated_by: userId ?? null,
    timestamp: new Date().toISOString(),
  });
}

export async function getKnowledgeVersionSnapshots(
  knowledgeId: string,
  orgId: string,
  limit = 20
): Promise<KnowledgeVersionSnapshot[]> {
  const snap = await db
    .collection(COL_VERSIONS)
    .where("knowledge_id", "==", knowledgeId)
    .where("org_id", "==", orgId)
    .orderBy("version_number", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      knowledge_id: d.knowledge_id ?? "",
      org_id: d.org_id ?? "",
      version_number: d.version_number ?? 0,
      snapshot: (d.snapshot as Record<string, unknown>) ?? {},
      updated_by: d.updated_by ?? null,
      timestamp: toISO(d.timestamp),
    };
  });
}

export async function getKnowledgeVersionByNumber(
  knowledgeId: string,
  orgId: string,
  versionNumber: number
): Promise<KnowledgeVersionSnapshot | null> {
  const snap = await db
    .collection(COL_VERSIONS)
    .where("knowledge_id", "==", knowledgeId)
    .where("org_id", "==", orgId)
    .where("version_number", "==", versionNumber)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const d = snap.docs[0]!.data();
  return {
    knowledge_id: d.knowledge_id ?? "",
    org_id: d.org_id ?? "",
    version_number: d.version_number ?? 0,
    snapshot: (d.snapshot as Record<string, unknown>) ?? {},
    updated_by: d.updated_by ?? null,
    timestamp: toISO(d.timestamp),
  };
}
