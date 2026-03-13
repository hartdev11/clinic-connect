/**
 * Phase 20 — Agency commission tracking
 * recordCommission: เมื่อ payment สำเร็จ
 * reverseCommission: เมื่อ refund หรือ payment failure
 */
import { db } from "@/lib/firebase-admin";

const AGENCIES_COL = "agencies";
const COMMISSIONS_COL = "agency_commissions";

async function getAgencyCommissionRate(agencyId: string): Promise<number> {
  const doc = await db.collection(AGENCIES_COL).doc(agencyId).get();
  if (!doc.exists) return 0;
  const d = doc.data()!;
  return typeof d.commissionRate === "number" ? d.commissionRate : 0;
}

export async function getOrgAgencyId(orgId: string): Promise<string | null> {
  const doc = await db.collection("organizations").doc(orgId).get();
  if (!doc.exists) return null;
  return (doc.data()?.agencyId as string) || null;
}

/**
 * บันทึก commission เมื่อ payment สำเร็จ
 * amount ใน satang
 */
export async function recordCommission(
  orgId: string,
  subscriptionId: string,
  amount: number
): Promise<string | null> {
  const agencyId = await getOrgAgencyId(orgId);
  if (!agencyId) return null;

  const rate = await getAgencyCommissionRate(agencyId);
  if (rate <= 0) return null;

  const commissionAmount = Math.round(amount * rate);

  const { FieldValue } = await import("firebase-admin/firestore");

  const docRef = await db.collection(COMMISSIONS_COL).add({
    agencyId,
    orgId,
    subscriptionId,
    amount,
    commissionAmount,
    status: "paid",
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.collection(AGENCIES_COL).doc(agencyId).update({
    totalRevenue: FieldValue.increment(amount),
    totalCommission: FieldValue.increment(commissionAmount),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Reverse commission เมื่อ refund หรือ payment failure
 */
export async function reverseCommission(
  commissionId: string,
  reason?: string
): Promise<boolean> {
  const docRef = db.collection(COMMISSIONS_COL).doc(commissionId);
  const doc = await docRef.get();
  if (!doc.exists) return false;

  const d = doc.data()!;
  if (d.status === "reversed") return true; // idempotent

  const agencyId = d.agencyId as string;
  const commissionAmount = (d.commissionAmount as number) ?? 0;
  const amount = (d.amount as number) ?? 0;

  const { FieldValue } = await import("firebase-admin/firestore");
  const now = new Date().toISOString();

  await docRef.update({
    status: "reversed",
    reversedAt: now,
    reverseReason: reason ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection(AGENCIES_COL).doc(agencyId).update({
    totalRevenue: FieldValue.increment(-amount),
    totalCommission: FieldValue.increment(-commissionAmount),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return true;
}

/** หา commission จาก org + subscription (Firestore) + amount สำหรับ reverse */
export async function findCommissionToReverse(
  orgId: string,
  subscriptionId: string,
  amount: number
): Promise<string | null> {
  const snap = await db
    .collection(COMMISSIONS_COL)
    .where("orgId", "==", orgId)
    .where("subscriptionId", "==", subscriptionId)
    .where("amount", "==", amount)
    .where("status", "==", "paid")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  return snap.empty ? null : snap.docs[0].id;
}
