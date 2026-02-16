/**
 * Unified AI Knowledge — Data Layer
 * global_services (from global_knowledge), clinic_services, clinic_faq
 * Multi-tenant: strict clinic_id (org_id) isolation.
 */
import { db } from "@/lib/firebase-admin";
import { listGlobalKnowledge } from "@/lib/knowledge-brain/data";
import type {
  GlobalService,
  ClinicService,
  ClinicServiceCreate,
  ClinicServiceUpdate,
  ClinicServiceStatus,
  ClinicFaq,
  ClinicFaqCreate,
  ClinicFaqUpdate,
  ClinicFaqStatus,
} from "@/types/unified-knowledge";

const COL_CLINIC_SERVICES = "clinic_services";
const COL_CLINIC_FAQ = "clinic_faq";

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

function clinicServicesRef(orgId: string) {
  return db.collection("organizations").doc(orgId).collection(COL_CLINIC_SERVICES);
}

function clinicFaqRef(orgId: string) {
  return db.collection("organizations").doc(orgId).collection(COL_CLINIC_FAQ);
}

// ─── Global Services (mapped from global_knowledge) ────────────────────────

export async function listGlobalServices(limit = 200): Promise<GlobalService[]> {
  const rows = await listGlobalKnowledge(limit);
  return rows.map((g) => ({
    id: g.id,
    name: g.service_name,
    standard_description: g.description,
    compliance_locked: false,
    version: g.version,
    created_at: g.last_updated,
    updated_at: g.last_updated,
  }));
}

export async function getGlobalServiceById(id: string): Promise<GlobalService | null> {
  const { getGlobalKnowledgeById } = await import("@/lib/knowledge-brain/data");
  const g = await getGlobalKnowledgeById(id);
  if (!g) return null;
  return {
    id: g.id,
    name: g.service_name,
    standard_description: g.description,
    compliance_locked: false,
    version: g.version,
    created_at: g.last_updated,
    updated_at: g.last_updated,
  };
}

// ─── Clinic Services ───────────────────────────────────────────────────────

const EMBEDDING_VERSION_DEFAULT = "v1";

function mapClinicServiceDoc(
  id: string,
  clinicId: string,
  d: Record<string, unknown>
): ClinicService {
  return {
    id,
    clinic_id: clinicId,
    global_service_id: (d.global_service_id as string) ?? null,
    custom_title: (d.custom_title as string) ?? "",
    custom_highlight: (d.custom_highlight as string) ?? "",
    custom_price: (d.custom_price as string) ?? "",
    custom_description: (d.custom_description as string) ?? "",
    status: (d.status as ClinicServiceStatus) ?? "active",
    embedding_version: (d.embedding_version as string) ?? EMBEDDING_VERSION_DEFAULT,
    template_version_at_embed: typeof d.template_version_at_embed === "number" ? d.template_version_at_embed : null,
    last_embedded_at: d.last_embedded_at ? toISO(d.last_embedded_at) : null,
    deleted_at: d.deleted_at ? toISO(d.deleted_at) : null,
    created_at: toISO(d.created_at),
    updated_at: toISO(d.updated_at),
  };
}

export async function listClinicServices(
  orgId: string,
  opts?: { status?: ClinicServiceStatus; limit?: number; includeDeleted?: boolean }
): Promise<ClinicService[]> {
  const limit = Math.min(opts?.limit ?? 100, 200);
  const snap = await clinicServicesRef(orgId)
    .orderBy("updated_at", "desc")
    .limit(Math.min(limit * 3, 300))
    .get();
  let items = snap.docs.map((doc) => {
    const d = doc.data();
    return mapClinicServiceDoc(doc.id, orgId, d);
  });
  if (!opts?.includeDeleted) items = items.filter((s) => !s.deleted_at);
  if (opts?.status) items = items.filter((s) => s.status === opts.status);
  return items.slice(0, limit);
}

export async function getClinicServiceById(orgId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<ClinicService | null> {
  const doc = await clinicServicesRef(orgId).doc(id).get();
  if (!doc.exists) return null;
  const s = mapClinicServiceDoc(doc.id, orgId, doc.data()!);
  if (!opts?.includeDeleted && s.deleted_at) return null;
  return s;
}

export async function createClinicService(
  data: ClinicServiceCreate,
  userId?: string | null
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await clinicServicesRef(data.clinic_id).add({
    clinic_id: data.clinic_id,
    global_service_id: data.global_service_id ?? null,
    custom_title: data.custom_title,
    custom_highlight: data.custom_highlight ?? "",
    custom_price: data.custom_price ?? "",
    custom_description: data.custom_description ?? "",
    status: data.status ?? "active",
    embedding_version: EMBEDDING_VERSION_DEFAULT,
    template_version_at_embed: null,
    last_embedded_at: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    updated_by: userId ?? null,
  });
  return ref.id;
}

export async function updateClinicService(
  orgId: string,
  id: string,
  data: ClinicServiceUpdate,
  _userId?: string | null
): Promise<boolean> {
  const ref = clinicServicesRef(orgId).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.custom_title !== undefined) update.custom_title = data.custom_title;
  if (data.custom_highlight !== undefined) update.custom_highlight = data.custom_highlight;
  if (data.custom_price !== undefined) update.custom_price = data.custom_price;
  if (data.custom_description !== undefined) update.custom_description = data.custom_description;
  if (data.status !== undefined) update.status = data.status;
  await ref.update(update);
  return true;
}

/** Mark service as embedding_failed (queue processor on final failure). */
export async function markClinicServiceEmbeddingFailed(orgId: string, id: string): Promise<boolean> {
  const ref = clinicServicesRef(orgId).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.update({
    status: "embedding_failed",
    updated_at: new Date().toISOString(),
  });
  return true;
}

/** Set template_version_at_embed and clear embedding_failed after successful embed. */
export async function setClinicServiceEmbeddingSuccess(
  orgId: string,
  id: string,
  templateVersion: number
): Promise<boolean> {
  const ref = clinicServicesRef(orgId).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.update({
    template_version_at_embed: templateVersion,
    last_embedded_at: new Date().toISOString(),
    status: "active",
    updated_at: new Date().toISOString(),
  });
  return true;
}

/** Soft delete clinic service (archive). */
export async function softDeleteClinicService(orgId: string, id: string): Promise<boolean> {
  const ref = clinicServicesRef(orgId).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  const now = new Date().toISOString();
  await ref.update({ deleted_at: now, updated_at: now });
  return true;
}

// ─── Clinic FAQ ────────────────────────────────────────────────────────────

function mapClinicFaqDoc(id: string, clinicId: string, d: Record<string, unknown>): ClinicFaq {
  return {
    id,
    clinic_id: clinicId,
    question: (d.question as string) ?? "",
    answer: (d.answer as string) ?? "",
    status: (d.status as ClinicFaqStatus) ?? "active",
    embedding_version: (d.embedding_version as string) ?? EMBEDDING_VERSION_DEFAULT,
    last_embedded_at: d.last_embedded_at ? toISO(d.last_embedded_at) : null,
    deleted_at: d.deleted_at ? toISO(d.deleted_at) : null,
    created_at: toISO(d.created_at),
    updated_at: toISO(d.updated_at),
  };
}

export async function listClinicFaq(orgId: string, limit = 100, opts?: { includeDeleted?: boolean }): Promise<ClinicFaq[]> {
  const snap = await clinicFaqRef(orgId).orderBy("updated_at", "desc").limit(opts?.includeDeleted ? limit : limit * 2).get();
  let items = snap.docs.map((doc) => {
    const d = doc.data();
    return mapClinicFaqDoc(doc.id, orgId, d);
  });
  if (!opts?.includeDeleted) items = items.filter((f) => !f.deleted_at);
  return items.slice(0, limit);
}

export async function getClinicFaqById(orgId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<ClinicFaq | null> {
  const doc = await clinicFaqRef(orgId).doc(id).get();
  if (!doc.exists) return null;
  const f = mapClinicFaqDoc(doc.id, orgId, doc.data()!);
  if (!opts?.includeDeleted && f.deleted_at) return null;
  return f;
}

export async function createClinicFaq(
  data: ClinicFaqCreate,
  userId?: string | null
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await clinicFaqRef(data.clinic_id).add({
    clinic_id: data.clinic_id,
    question: data.question,
    answer: data.answer,
    status: data.status ?? "active",
    embedding_version: EMBEDDING_VERSION_DEFAULT,
    last_embedded_at: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    updated_by: userId ?? null,
  });
  return ref.id;
}

export async function updateClinicFaq(
  orgId: string,
  id: string,
  data: ClinicFaqUpdate,
  _userId?: string | null
): Promise<boolean> {
  const ref = clinicFaqRef(orgId).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.question !== undefined) update.question = data.question;
  if (data.answer !== undefined) update.answer = data.answer;
  if (data.status !== undefined) update.status = data.status;
  await ref.update(update);
  return true;
}

/** Mark FAQ as embedding_failed (queue processor on final failure). */
export async function markClinicFaqEmbeddingFailed(orgId: string, id: string): Promise<boolean> {
  const ref = clinicFaqRef(orgId).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.update({
    status: "embedding_failed",
    updated_at: new Date().toISOString(),
  });
  return true;
}

/** Set last_embedded_at and status active after successful FAQ embed. */
export async function setClinicFaqEmbeddingSuccess(orgId: string, id: string): Promise<boolean> {
  const ref = clinicFaqRef(orgId).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  const now = new Date().toISOString();
  await ref.update({
    last_embedded_at: now,
    status: "active",
    updated_at: now,
  });
  return true;
}

/** Soft delete FAQ (archive). */
export async function softDeleteClinicFaq(orgId: string, id: string): Promise<boolean> {
  const ref = clinicFaqRef(orgId).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  const now = new Date().toISOString();
  await ref.update({ deleted_at: now, updated_at: now });
  return true;
}

/** Hard delete FAQ (removes doc; use after soft delete for cleanup if needed). */
export async function deleteClinicFaq(orgId: string, id: string): Promise<boolean> {
  const ref = clinicFaqRef(orgId).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.delete();
  return true;
}
