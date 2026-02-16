/**
 * Phase 2 — Migrate knowledge_topics + clinic_knowledge → clinic_services / clinic_faq
 * One-time per org; skip if already migrated (unified_knowledge_migrated_at set).
 */
import { db } from "@/lib/firebase-admin";
import {
  listKnowledgeTopics,
  getActiveKnowledgeVersion,
} from "@/lib/knowledge-topics-data";
import {
  listClinicKnowledge,
  getGlobalKnowledgeById,
} from "@/lib/knowledge-brain/data";
import {
  listClinicServices,
  createClinicService,
  createClinicFaq,
  listClinicFaq,
} from "@/lib/unified-knowledge/data";
import { enqueueUnifiedServiceEmbed, enqueueUnifiedFaqEmbed } from "@/lib/knowledge-brain/embedding-queue";

const MIGRATED_FIELD = "unified_knowledge_migrated_at";

export interface MigrateResult {
  org_id: string;
  skipped: boolean;
  reason?: string;
  services_created: number;
  faq_created: number;
  errors: string[];
}

/**
 * Migrate one org: knowledge_topics → clinic_services/faq, clinic_knowledge (approved) → clinic_services.
 * Skip if org has unified_knowledge_migrated_at set (unless force=true).
 */
export async function migrateOrgToUnifiedKnowledge(
  orgId: string,
  opts?: { force?: boolean }
): Promise<MigrateResult> {
  const result: MigrateResult = {
    org_id: orgId,
    skipped: false,
    services_created: 0,
    faq_created: 0,
    errors: [],
  };

  const orgRef = db.collection("organizations").doc(orgId);
  const orgDoc = await orgRef.get();
  if (!orgDoc.exists) {
    result.skipped = true;
    result.reason = "Organization not found";
    return result;
  }

  const data = orgDoc.data();
  if (!opts?.force && data?.[MIGRATED_FIELD]) {
    result.skipped = true;
    result.reason = "Already migrated";
    return result;
  }

  let existingServices = await listClinicServices(orgId, { limit: 500 });
  let existingFaq = await listClinicFaq(orgId, 500);

  try {
    // 1) knowledge_topics → clinic_services (category !== faq) or clinic_faq (category === faq)
    const topics = await listKnowledgeTopics(orgId, { limit: 200 });
    const existingTitles = new Set(existingServices.map((s) => s.custom_title.trim().toLowerCase()));
    const existingFaqQuestions = new Set(existingFaq.map((f) => f.question.trim().toLowerCase()));

    for (const topic of topics) {
      const activeVersion = topic.activeVersionId
        ? await getActiveKnowledgeVersion(orgId, topic.id)
        : null;
      const content = activeVersion?.content ?? "";
      const summary = activeVersion?.summary ?? [];
      const title = topic.topic?.trim() || "ไม่มีชื่อ";

      if (topic.category === "faq") {
        if (existingFaqQuestions.has(title.toLowerCase())) continue;
        try {
          const id = await createClinicFaq(
            { clinic_id: orgId, question: title, answer: content },
            null
          );
          await enqueueUnifiedFaqEmbed(orgId, id);
          result.faq_created++;
          existingFaqQuestions.add(title.toLowerCase());
        } catch (e) {
          result.errors.push(`FAQ "${title.slice(0, 30)}": ${(e as Error).message}`);
        }
      } else {
        if (existingTitles.has(title.toLowerCase())) continue;
        try {
          const id = await createClinicService(
            {
              clinic_id: orgId,
              global_service_id: null,
              custom_title: title,
              custom_highlight: summary[0] ?? "",
              custom_price: "",
              custom_description: content.slice(0, 2000),
              status: "active",
            },
            null
          );
          await enqueueUnifiedServiceEmbed(orgId, id);
          result.services_created++;
          existingTitles.add(title.toLowerCase());
        } catch (e) {
          result.errors.push(`Service "${title.slice(0, 30)}": ${(e as Error).message}`);
        }
      }
    }

    // 2) clinic_knowledge (approved) → clinic_services with global_service_id
    const clinicKnowledges = await listClinicKnowledge(orgId, {
      status: "approved",
      limit: 200,
    });
    const existingGlobalIds = new Set(
      existingServices
        .map((s) => s.global_service_id)
        .filter((id): id is string => !!id)
    );

    for (const ck of clinicKnowledges) {
      if (existingGlobalIds.has(ck.base_service_id)) continue;
      const global = await getGlobalKnowledgeById(ck.base_service_id);
      const serviceName = global?.service_name ?? ck.custom_brand ?? "บริการ";
      try {
        const id = await createClinicService(
          {
            clinic_id: orgId,
            global_service_id: ck.base_service_id,
            custom_title: serviceName,
            custom_highlight: ck.custom_differentiator ?? "",
            custom_price: ck.custom_price_range ?? "",
            custom_description: ck.custom_notes ?? "",
            status: "active",
          },
          null
        );
        await enqueueUnifiedServiceEmbed(orgId, id);
        result.services_created++;
        existingGlobalIds.add(ck.base_service_id);
      } catch (e) {
        result.errors.push(`ClinicKnowledge ${ck.id}: ${(e as Error).message}`);
      }
    }

    await orgRef.update({
      [MIGRATED_FIELD]: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    result.errors.push(`Org migration: ${(e as Error).message}`);
  }

  return result;
}

/**
 * Migrate all orgs that don't have unified_knowledge_migrated_at.
 */
export async function migrateAllOrgsToUnifiedKnowledge(opts?: {
  limit?: number;
  force?: boolean;
}): Promise<MigrateResult[]> {
  const maxOrgs = opts?.limit ?? 100;
  const snap = await db.collection("organizations").limit(maxOrgs).get();
  const results: MigrateResult[] = [];
  for (const doc of snap.docs) {
    const orgId = doc.id;
    const data = doc.data();
    if (!opts?.force && data?.[MIGRATED_FIELD]) continue;
    const res = await migrateOrgToUnifiedKnowledge(orgId, { force: opts?.force });
    results.push(res);
  }
  return results;
}
