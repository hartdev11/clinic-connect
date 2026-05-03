/**
 * Unified Knowledge — Vector upsert for RAG
 * Same Pinecone namespace as knowledge-brain (kb_orgId) so searchKnowledgeBrain returns these.
 * Embedding model: same as knowledge-brain (embedKnowledgeText).
 */
import { sanitizeServiceText, sanitizeFaqText } from "@/lib/unified-knowledge/sanitize";
import type { GlobalService, ClinicService, ClinicFaq } from "@/types/unified-knowledge";

const KNOWLEDGE_UPLOAD_PATH = "/api/knowledge/upload";

function resolveKnowledgeVectorBaseUrl(): string | null {
  return (
    process.env.KNOWLEDGE_VECTOR_URL?.trim().replace(/\/+$/, "") ??
    process.env.PHASE_G_URL?.trim().replace(/\/+$/, "") ??
    null
  );
}

async function uploadKnowledgeToVm(payload: Record<string, unknown>): Promise<void> {
  const baseUrl = resolveKnowledgeVectorBaseUrl();
  if (!baseUrl) {
    console.error("[Unified Knowledge Upload] Missing KNOWLEDGE_VECTOR_URL/PHASE_G_URL");
    return;
  }
  const serviceSecret = process.env.PHASE_SERVICE_SECRET?.trim() ?? "";
  try {
    const res = await fetch(`${baseUrl}${KNOWLEDGE_UPLOAD_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": serviceSecret,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const details = await res.text().catch(() => "");
      console.error("[Unified Knowledge Upload] VM upload failed", res.status, details.slice(0, 300));
    }
  } catch (error) {
    console.error("[Unified Knowledge Upload] VM upload request error", error);
  }
}

/** Build embeddable text: global standard + clinic overrides (priority: clinic first) */
function buildServiceText(service: ClinicService, global: GlobalService | null): string {
  const parts: string[] = [];
  const title = service.custom_title?.trim() || global?.name || "บริการ";
  parts.push(title);
  if (global?.standard_description) parts.push(global.standard_description);
  if (service.custom_highlight) parts.push("จุดเด่น:", service.custom_highlight);
  if (service.custom_price) parts.push("ราคา:", service.custom_price);
  if (service.custom_description) parts.push(service.custom_description);
  return parts.filter(Boolean).join("\n").slice(0, 8191);
}

function buildFaqText(faq: ClinicFaq): string {
  return [faq.question, faq.answer].filter(Boolean).join("\n").slice(0, 8191);
}

export async function upsertUnifiedServiceToVector(
  orgId: string,
  service: ClinicService,
  global: GlobalService | null
): Promise<void> {
  const raw = buildServiceText(service, global);
  const { text } = sanitizeServiceText(raw);
  const vectorId = `unified_svc_${service.id}`;
  await uploadKnowledgeToVm({
    tenant_id: orgId,
    clinic_id: orgId,
    scope: "clinic",
    source_type: "procedure_knowledge",
    content: text,
    topic: service.custom_title?.trim() || global?.name || service.id,
    language: "th",
    document_id: vectorId,
    document_version: "unified_service_v1",
  });

  // DISABLED: Using ChromaDB via VM instead
  // const embedding = await embedKnowledgeText(text);
  // const index = getKnowledgeIndex();
  // const ns = index.namespace(getOrgNamespace(orgId));
  // await ns.upsert({ records: [...] });
}

export async function upsertUnifiedFaqToVector(orgId: string, faq: ClinicFaq): Promise<void> {
  const raw = buildFaqText(faq);
  const { text } = sanitizeFaqText(raw);
  const vectorId = `unified_faq_${faq.id}`;
  await uploadKnowledgeToVm({
    tenant_id: orgId,
    clinic_id: orgId,
    scope: "clinic",
    source_type: "faq_knowledge",
    content: text,
    topic: faq.question?.slice(0, 120) || faq.id,
    language: "th",
    document_id: vectorId,
    document_version: "unified_faq_v1",
  });

  // DISABLED: Using ChromaDB via VM instead
  // const embedding = await embedKnowledgeText(text);
  // const index = getKnowledgeIndex();
  // const ns = index.namespace(getOrgNamespace(orgId));
  // await ns.upsert({ records: [...] });
}

export async function deleteUnifiedServiceFromVector(orgId: string, serviceId: string): Promise<void> {
  try {
    await uploadKnowledgeToVm({
      tenant_id: orgId,
      clinic_id: orgId,
      document_id: `unified_svc_${serviceId}`,
      action: "delete",
    });
  } catch {
    // ignore if not found
  }
}

export async function deleteUnifiedFaqFromVector(orgId: string, faqId: string): Promise<void> {
  try {
    await uploadKnowledgeToVm({
      tenant_id: orgId,
      clinic_id: orgId,
      document_id: `unified_faq_${faqId}`,
      action: "delete",
    });
  } catch {
    // ignore if not found
  }
}
