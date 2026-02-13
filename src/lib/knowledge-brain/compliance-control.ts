/**
 * Phase 3 #5 — Global Compliance Override System
 * Admin: disable service, inject disclaimer, override risky phrase, force re-approval campaign
 */
import { db } from "@/lib/firebase-admin";

const COL = "global_policy_rules";
const OVERRIDE_ID = "compliance_override";

export interface ComplianceOverride {
  id: string;
  compliance_override_active: boolean;
  disabled_services: string[];
  global_mandatory_disclaimer: string | null;
  risky_phrase_overrides: Record<string, string>; // phrase → replacement
  force_reapproval_service_ids: string[];
  updated_at: string;
}

export async function getComplianceOverride(): Promise<ComplianceOverride> {
  const doc = await db.collection(COL).doc(OVERRIDE_ID).get();
  const d = doc.exists ? doc.data() : null;
  return {
    id: OVERRIDE_ID,
    compliance_override_active: d?.compliance_override_active ?? false,
    disabled_services: Array.isArray(d?.disabled_services) ? d.disabled_services : [],
    global_mandatory_disclaimer: d?.global_mandatory_disclaimer ?? null,
    risky_phrase_overrides: typeof d?.risky_phrase_overrides === "object" ? d.risky_phrase_overrides : {},
    force_reapproval_service_ids: Array.isArray(d?.force_reapproval_service_ids) ? d.force_reapproval_service_ids : [],
    updated_at: d?.updated_at ? String(d.updated_at) : new Date().toISOString(),
  };
}

export async function setComplianceOverride(data: Partial<ComplianceOverride>): Promise<void> {
  const ref = db.collection(COL).doc(OVERRIDE_ID);
  await ref.set(
    {
      compliance_override_active: data.compliance_override_active,
      disabled_services: data.disabled_services,
      global_mandatory_disclaimer: data.global_mandatory_disclaimer,
      risky_phrase_overrides: data.risky_phrase_overrides,
      force_reapproval_service_ids: data.force_reapproval_service_ids,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function disableServiceGlobally(serviceId: string): Promise<void> {
  const over = await getComplianceOverride();
  const disabled = [...new Set([...over.disabled_services, serviceId])];
  await setComplianceOverride({ ...over, disabled_services: disabled });
}

export async function forceReapprovalCampaign(serviceIds: string[]): Promise<number> {
  const clinicSnap = await db
    .collection("clinic_knowledge")
    .where("base_service_id", "in", serviceIds.slice(0, 10))
    .get();

  const now = new Date().toISOString();
  for (const doc of clinicSnap.docs) {
    await doc.ref.update({ status: "needs_review", updated_at: now });
  }
  await setComplianceOverride({
    force_reapproval_service_ids: [
      ...new Set([...(await getComplianceOverride()).force_reapproval_service_ids, ...serviceIds]),
    ],
  });
  return clinicSnap.size;
}
