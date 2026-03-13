/**
 * Phase 20 — Agency data layer
 */
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import type { Agency, AgencyCreate, AgencyStatus } from "@/types/agency";

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = t && typeof t === "object" && "toDate" in t && typeof (t as { toDate: () => Date }).toDate === "function"
    ? (t as { toDate: () => Date }).toDate()
    : null;
  return d ? new Date(d).toISOString() : new Date().toISOString();
}

export async function createAgency(data: AgencyCreate): Promise<string> {
  const ref = db.collection("agencies").doc();
  const now = new Date().toISOString();
  await ref.set({
    name: data.name,
    slug: data.slug,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone ?? null,
    commissionRate: data.commissionRate ?? 0,
    status: "active",
    totalRevenue: 0,
    totalCommission: 0,
    customDomain: data.customDomain ?? null,
    logoUrl: data.logoUrl ?? null,
    primaryColor: data.primaryColor ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function listAgencies(): Promise<Agency[]> {
  const snap = await db.collection("agencies").orderBy("createdAt", "desc").get();
  return Promise.all(snap.docs.map((d) => getAgencyById(d.id))).then((arr) =>
    arr.filter((a): a is Agency => a !== null)
  );
}

export async function updateOrgAgencyId(orgId: string, agencyId: string | null): Promise<void> {
  await db.collection("organizations").doc(orgId).update({
    agencyId: agencyId ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function getAgencyById(agencyId: string): Promise<Agency | null> {
  const doc = await db.collection("agencies").doc(agencyId).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    id: doc.id,
    name: (d.name as string) ?? "",
    slug: (d.slug as string) ?? "",
    contactEmail: (d.contactEmail as string) ?? "",
    contactPhone: (d.contactPhone as string) ?? null,
    commissionRate: typeof d.commissionRate === "number" ? d.commissionRate : 0,
    status: (d.status as AgencyStatus) ?? "active",
    totalRevenue: typeof d.totalRevenue === "number" ? d.totalRevenue : 0,
    totalCommission: typeof d.totalCommission === "number" ? d.totalCommission : 0,
    customDomain: (d.customDomain as string) ?? null,
    logoUrl: (d.logoUrl as string) ?? null,
    primaryColor: (d.primaryColor as string) ?? null,
    createdAt: toISO(d.createdAt),
    updatedAt: toISO(d.updatedAt),
  };
}

export async function getAgencyByCustomDomain(hostname: string): Promise<Agency | null> {
  const snap = await db
    .collection("agencies")
    .where("customDomain", "==", hostname)
    .where("status", "==", "active")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return getAgencyById(snap.docs[0].id);
}

export async function getAgencyBySlug(slug: string): Promise<Agency | null> {
  const snap = await db
    .collection("agencies")
    .where("slug", "==", slug)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return getAgencyById(snap.docs[0].id);
}

export async function getOrgsByAgencyId(agencyId: string): Promise<Array<{ id: string; name: string; plan: string }>> {
  const snap = await db
    .collection("organizations")
    .where("agencyId", "==", agencyId)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: (data.name as string) ?? "",
      plan: (data.plan as string) ?? "starter",
    };
  });
}

export async function getCommissionStatsForAgency(
  agencyId: string,
  months: number = 6
): Promise<Array<{ month: string; revenue: number; commission: number }>> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const sinceStr = since.toISOString().slice(0, 7); // YYYY-MM

  const snap = await db
    .collection("agency_commissions")
    .where("agencyId", "==", agencyId)
    .where("status", "==", "paid")
    .get();

  const byMonth: Record<string, { revenue: number; commission: number }> = {};
  for (let i = 0; i < months; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    byMonth[key] = { revenue: 0, commission: 0 };
  }

  for (const doc of snap.docs) {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.() ?? new Date();
    const key = createdAt.toISOString().slice(0, 7);
    if (key >= sinceStr && byMonth[key]) {
      byMonth[key].revenue += (data.amount as number) ?? 0;
      byMonth[key].commission += (data.commissionAmount as number) ?? 0;
    }
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, revenue: v.revenue, commission: v.commission }));
}
