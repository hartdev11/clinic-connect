/**
 * Phase 9 — Flexible pricing packages
 * Firestore: global/pricing_packages/{id}
 */
import { db } from "@/lib/firebase-admin";
import type {
  PricingPackage,
  PricingPackageCreate,
  PricingPackageUpdate,
} from "@/types/pricing";

/** Firestore: global/pricing_packages/packages/{packageId} */
const GLOBAL_COL = "global";
const DOC_ID = "pricing_packages";
const SUB_COL = "packages";

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

function packagesRef() {
  return db.collection(GLOBAL_COL).doc(DOC_ID).collection(SUB_COL);
}

function mapDoc(id: string, d: Record<string, unknown>): PricingPackage {
  const features = (d.features as Record<string, boolean>) ?? {};
  return {
    id,
    packageName: (d.packageName as string) ?? "",
    packageSlug: (d.packageSlug as string) ?? "",
    description: (d.description as string) ?? "",
    price: typeof d.price === "number" ? d.price : 0,
    currency: "THB",
    billingPeriod: (d.billingPeriod as "monthly" | "yearly") ?? "monthly",
    conversationsIncluded: typeof d.conversationsIncluded === "number" ? d.conversationsIncluded : 0,
    maxBranches: typeof d.maxBranches === "number" ? d.maxBranches : 1,
    maxUsers: typeof d.maxUsers === "number" ? d.maxUsers : 1,
    features: {
      ai_chat: !!features.ai_chat,
      analytics: !!features.analytics,
      white_label: !!features.white_label,
      api_access: !!features.api_access,
      priority_support: !!features.priority_support,
    },
    allowTopup: !!(d.allowTopup ?? false),
    topupPricePer100: typeof d.topupPricePer100 === "number" ? d.topupPricePer100 : 0,
    topupPricePer500: typeof d.topupPricePer500 === "number" ? d.topupPricePer500 : undefined,
    topupPricePer1000: typeof d.topupPricePer1000 === "number" ? d.topupPricePer1000 : undefined,
    isActive: !!(d.isActive ?? true),
    isPublic: !!(d.isPublic ?? true),
    sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : 0,
    createdAt: toISO(d.createdAt),
    updatedAt: toISO(d.updatedAt),
  };
}

export async function listPricingPackages(): Promise<PricingPackage[]> {
  const snap = await packagesRef().orderBy("sortOrder", "asc").orderBy("createdAt", "asc").get();
  return snap.docs.map((doc) => mapDoc(doc.id, doc.data()));
}

export async function getPricingPackage(id: string): Promise<PricingPackage | null> {
  const doc = await packagesRef().doc(id).get();
  if (!doc.exists) return null;
  return mapDoc(doc.id, doc.data()!);
}

export async function createPricingPackage(data: PricingPackageCreate): Promise<string> {
  const now = new Date().toISOString();
  const ref = await packagesRef().add({
    packageName: data.packageName,
    packageSlug: data.packageSlug,
    description: data.description ?? "",
    price: data.price,
    currency: data.currency ?? "THB",
    billingPeriod: data.billingPeriod ?? "monthly",
    conversationsIncluded: data.conversationsIncluded ?? 0,
    maxBranches: data.maxBranches ?? 1,
    maxUsers: data.maxUsers ?? 1,
    features: data.features ?? {},
    allowTopup: data.allowTopup ?? false,
    topupPricePer100: data.topupPricePer100 ?? 0,
    isActive: data.isActive ?? true,
    isPublic: data.isPublic ?? true,
    sortOrder: data.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updatePricingPackage(
  id: string,
  data: PricingPackageUpdate
): Promise<boolean> {
  const ref = packagesRef().doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (data.packageName != null) updates.packageName = data.packageName;
  if (data.packageSlug != null) updates.packageSlug = data.packageSlug;
  if (data.description != null) updates.description = data.description;
  if (data.price != null) updates.price = data.price;
  if (data.billingPeriod != null) updates.billingPeriod = data.billingPeriod;
  if (data.conversationsIncluded != null) updates.conversationsIncluded = data.conversationsIncluded;
  if (data.maxBranches != null) updates.maxBranches = data.maxBranches;
  if (data.maxUsers != null) updates.maxUsers = data.maxUsers;
  if (data.features != null) updates.features = data.features;
  if (data.allowTopup != null) updates.allowTopup = data.allowTopup;
  if (data.topupPricePer100 != null) updates.topupPricePer100 = data.topupPricePer100;
  if (data.isActive != null) updates.isActive = data.isActive;
  if (data.isPublic != null) updates.isPublic = data.isPublic;
  if (data.sortOrder != null) updates.sortOrder = data.sortOrder;
  await ref.update(updates);
  return true;
}

export async function setPricingPackagesOrder(ids: string[]): Promise<void> {
  const batch = db.batch();
  ids.forEach((id, index) => {
    const ref = packagesRef().doc(id);
    batch.update(ref, { sortOrder: index, updatedAt: new Date().toISOString() });
  });
  await batch.commit();
}
