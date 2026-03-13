/**
 * Onboarding Wizard — Data Layer
 * Guard, ai_config, TenantConfig, org updates
 */
import { db } from "@/lib/firebase-admin";
import type { DayOfWeek } from "@/types/clinic";

const COLLECTIONS = {
  organizations: "organizations",
  branches: "branches",
  tenant_configs: "tenant_configs",
} as const;

import type { MedicalPolicyLevel, VoiceId } from "@/types/ai-config";

export interface AiConfigSettings {
  clinic_style: "luxury" | "budget" | "friendly";
  ai_tone: "formal" | "casual" | "fun";
  usp: string;
  competitors: string[];
  greeting_message: string;
  fallback_message: string;
  handoff_message: string;
  /** Phase 15: Medical policy for อย. compliance */
  medicalPolicy?: MedicalPolicyLevel;
  /** Phase 22: Voice persona V01-V06 */
  voice_id?: VoiceId | null;
  /** Phase 22: consultative | direct | education_first */
  sales_strategy?: "consultative" | "direct" | "education_first";
  /** Phase 23: แสดงช่วงราคา — default ON */
  show_price_range?: boolean;
  /** Phase 23: แสดงราคาที่แน่นอน — default OFF */
  show_exact_price?: boolean;
  /** Phase 23: อนุญาตให้ต่อรองราคา — default OFF */
  negotiation_allowed?: boolean;
  /** Phase 23: การแสดงโปรโมชั่น — always | by_promotion_only | never */
  promotion_display?: "always" | "by_promotion_only" | "never";
  max_emoji_per_message?: number;
}

/** Check if org has completed onboarding (ai_config/settings exists) */
export async function hasAiConfig(orgId: string): Promise<boolean> {
  const doc = await db.collection(COLLECTIONS.organizations).doc(orgId).get();
  if (!doc.exists) return false;
  const data = doc.data();
  const aiConfig = data?.ai_config;
  return !!(
    aiConfig &&
    typeof aiConfig === "object" &&
    aiConfig.settings &&
    typeof aiConfig.settings === "object"
  );
}

/** Get ai_config settings if exists */
export async function getAiConfig(orgId: string): Promise<AiConfigSettings | null> {
  const doc = await db.collection(COLLECTIONS.organizations).doc(orgId).get();
  if (!doc.exists) return null;
  const s = doc.data()?.ai_config?.settings;
  if (!s || typeof s !== "object") return null;
  return {
    clinic_style: s.clinic_style ?? "friendly",
    ai_tone: s.ai_tone ?? "casual",
    usp: s.usp ?? "",
    competitors: Array.isArray(s.competitors) ? s.competitors : [],
    greeting_message: s.greeting_message ?? "",
    fallback_message: s.fallback_message ?? "",
    handoff_message: s.handoff_message ?? "",
    medicalPolicy: (s.medicalPolicy === "strict" || s.medicalPolicy === "moderate" || s.medicalPolicy === "permissive")
      ? s.medicalPolicy
      : "moderate",
    voice_id: (s.voice_id === "V01" || s.voice_id === "V02" || s.voice_id === "V03" || s.voice_id === "V04" || s.voice_id === "V05" || s.voice_id === "V06")
      ? s.voice_id
      : "V03",
    sales_strategy: (s.sales_strategy === "consultative" || s.sales_strategy === "direct" || s.sales_strategy === "education_first")
      ? s.sales_strategy
      : undefined,
    show_price_range: s.show_price_range !== false,
    show_exact_price: s.show_exact_price === true,
    negotiation_allowed: s.negotiation_allowed === true,
    promotion_display: (s.promotion_display === "always" || s.promotion_display === "by_promotion_only" || s.promotion_display === "never")
      ? s.promotion_display
      : "by_promotion_only",
    max_emoji_per_message: typeof s.max_emoji_per_message === "number" ? s.max_emoji_per_message : undefined,
  };
}

/** Update org basic info (step 1) */
export async function updateOrgBasicInfo(
  orgId: string,
  data: {
    clinicName?: string;
    address?: string;
    phone?: string;
    lineOA?: string;
  }
): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (data.clinicName !== undefined) updates.name = data.clinicName.trim();
  if (data.address !== undefined) updates.address = data.address.trim();
  if (data.phone !== undefined) updates.phone = data.phone.trim();
  if (data.lineOA !== undefined) updates.lineOA = data.lineOA?.trim() ?? "";
  await db.collection(COLLECTIONS.organizations).doc(orgId).update(updates);
}

/** Update branch address */
export async function updateBranchAddress(
  orgId: string,
  branchId: string,
  address: string
): Promise<void> {
  const doc = await db.collection(COLLECTIONS.branches).doc(branchId).get();
  if (!doc.exists || doc.data()?.org_id !== orgId) return;
  const { FieldValue } = await import("firebase-admin/firestore");
  await db.collection(COLLECTIONS.branches).doc(branchId).update({
    address: address.trim(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Day key for branch_hours */
export type BranchHoursDay = DayOfWeek;

/** Update branch hours (step 1) */
export async function updateBranchHoursForOnboarding(
  orgId: string,
  branchId: string,
  hours: Partial<Record<BranchHoursDay, { open: string; close: string } | null>>
): Promise<void> {
  const { upsertBranchHours } = await import("@/lib/clinic-data");
  const payload: Partial<Record<string, { open: string; close: string } | null>> = {};
  const days: BranchHoursDay[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  for (const d of days) {
    if (d in hours) payload[d] = hours[d as BranchHoursDay] ?? null;
  }
  await upsertBranchHours(orgId, branchId, payload as Parameters<typeof upsertBranchHours>[2]);
}

/** Save ai_config/settings (step 5) */
export async function saveAiConfigSettings(
  orgId: string,
  settings: AiConfigSettings
): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  await db
    .collection(COLLECTIONS.organizations)
    .doc(orgId)
    .update({
      ai_config: {
        settings: {
          clinic_style: settings.clinic_style,
          ai_tone: settings.ai_tone,
          usp: settings.usp,
          competitors: settings.competitors,
          greeting_message: settings.greeting_message,
          fallback_message: settings.fallback_message ?? "",
          handoff_message: settings.handoff_message ?? "",
        },
      },
      updatedAt: FieldValue.serverTimestamp(),
    });
}

/** Create TenantConfig document on complete */
export async function createTenantConfig(orgId: string): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const ref = db.collection(COLLECTIONS.tenant_configs).doc(orgId);
  const exists = await ref.get();
  if (exists.exists) return;
  await ref.set({
    org_id: orgId,
    onboarded_at: FieldValue.serverTimestamp(),
    ai_ready: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
