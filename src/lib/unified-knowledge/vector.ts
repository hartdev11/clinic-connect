/**
 * Unified Knowledge — Vector upsert for RAG
 * Same Pinecone namespace as knowledge-brain (kb_orgId) so searchKnowledgeBrain returns these.
 * Embedding model: same as knowledge-brain (embedKnowledgeText).
 */
import { getKnowledgeIndex } from "@/lib/pinecone";
import { embedKnowledgeText } from "@/lib/knowledge-brain/vector";
import { sanitizeServiceText, sanitizeFaqText } from "@/lib/unified-knowledge/sanitize";
import type { GlobalService, ClinicService, ClinicFaq } from "@/types/unified-knowledge";

const NAMESPACE_PREFIX = "kb";

function getOrgNamespace(orgId: string): string {
  return `${NAMESPACE_PREFIX}_${orgId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
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
  const embedding = await embedKnowledgeText(text);
  const index = getKnowledgeIndex();
  const ns = index.namespace(getOrgNamespace(orgId));
  const vectorId = `unified_svc_${service.id}`;
  await ns.upsert({
    records: [
      {
        id: vectorId,
        values: embedding,
        metadata: {
          type: "unified_service",
          org_id: orgId,
          service_id: service.id,
          content: text.slice(0, 2000),
          embedded_at: Date.now(),
        },
      },
    ],
  });
}

export async function upsertUnifiedFaqToVector(orgId: string, faq: ClinicFaq): Promise<void> {
  const raw = buildFaqText(faq);
  const { text } = sanitizeFaqText(raw);
  const embedding = await embedKnowledgeText(text);
  const index = getKnowledgeIndex();
  const ns = index.namespace(getOrgNamespace(orgId));
  const vectorId = `unified_faq_${faq.id}`;
  await ns.upsert({
    records: [
      {
        id: vectorId,
        values: embedding,
        metadata: {
          type: "unified_faq",
          org_id: orgId,
          faq_id: faq.id,
          content: text.slice(0, 2000),
          embedded_at: Date.now(),
        },
      },
    ],
  });
}

export async function deleteUnifiedServiceFromVector(orgId: string, serviceId: string): Promise<void> {
  try {
    const index = getKnowledgeIndex();
    const ns = index.namespace(getOrgNamespace(orgId));
    await ns.deleteOne({ id: `unified_svc_${serviceId}` });
  } catch {
    // ignore if not found
  }
}

export async function deleteUnifiedFaqFromVector(orgId: string, faqId: string): Promise<void> {
  try {
    const index = getKnowledgeIndex();
    const ns = index.namespace(getOrgNamespace(orgId));
    await ns.deleteOne({ id: `unified_faq_${faqId}` });
  } catch {
    // ignore if not found
  }
}
