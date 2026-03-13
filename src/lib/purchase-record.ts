/**
 * Enterprise: Purchase record — บันทึกการซื้อแพ็คเกจต่อ device + email verification
 */
import crypto from "crypto";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { OrgPlan } from "@/types/organization";
import {
  PURCHASE_COLLECTION,
  type PurchaseRecord,
  type PurchaseRecordCreate,
} from "@/types/purchase";
import type { Timestamp } from "firebase-admin/firestore";

function toISO(t: Timestamp | Date | { toDate?: () => Date } | string): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d =
    t && typeof (t as { toDate?: () => Date }).toDate === "function"
      ? (t as { toDate: () => Date }).toDate()
      : null;
  return d ? new Date(d).toISOString() : String(t);
}

function docToRecord(
  id: string,
  data: FirebaseFirestore.DocumentData
): PurchaseRecord {
  return {
    id,
    device_id: data.device_id ?? "",
    email: data.email ?? "",
    plan: (data.plan ?? "starter") as OrgPlan,
    email_verified: Boolean(data.email_verified),
    verification_token: data.verification_token ?? null,
    verified_at: data.verified_at ? toISO(data.verified_at) : null,
    license_key: data.license_key ?? "",
    stripe_session_id: data.stripe_session_id ?? null,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

/** สร้าง license_key ไม่ซ้ำ (รูปแบบ CC-xxxxx) */
function generateLicenseKey(): string {
  const segment = () =>
    Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(0, 8);
  return `CC-${segment()}-${segment()}`.toUpperCase();
}

/** สร้าง verification token */
function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createPurchaseRecord(
  input: PurchaseRecordCreate
): Promise<PurchaseRecord> {
  const now = FieldValue.serverTimestamp();
  const licenseKey = generateLicenseKey();
  const verificationToken = generateVerificationToken();

  const ref = db.collection(PURCHASE_COLLECTION).doc();
  const emailNorm = input.email.trim().toLowerCase();
  await ref.set({
    device_id: input.device_id,
    email: emailNorm,
    plan: input.plan,
    email_verified: false,
    verification_token: verificationToken,
    verified_at: null,
    license_key: licenseKey,
    stripe_session_id: input.stripe_session_id ?? null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: ref.id,
    device_id: input.device_id,
    email: emailNorm,
    plan: input.plan,
    email_verified: false,
    verification_token: verificationToken,
    verified_at: null,
    license_key: licenseKey,
    stripe_session_id: input.stripe_session_id ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function getPurchaseRecordByDeviceId(
  deviceId: string
): Promise<PurchaseRecord | null> {
  const snap = await db
    .collection(PURCHASE_COLLECTION)
    .where("device_id", "==", deviceId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return docToRecord(doc.id, doc.data());
}

export async function getPurchaseRecordByVerificationToken(
  token: string
): Promise<PurchaseRecord | null> {
  const snap = await db
    .collection(PURCHASE_COLLECTION)
    .where("verification_token", "==", token)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return docToRecord(doc.id, doc.data());
}

export async function getPurchaseRecordByEmail(
  email: string
): Promise<PurchaseRecord | null> {
  const normalized = email.trim().toLowerCase();
  const snap = await db
    .collection(PURCHASE_COLLECTION)
    .where("email", "==", normalized)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return docToRecord(doc.id, doc.data());
}

export async function getPurchaseRecordByLicenseKey(
  licenseKey: string
): Promise<PurchaseRecord | null> {
  const key = licenseKey.trim();
  const snap = await db
    .collection(PURCHASE_COLLECTION)
    .where("license_key", "==", key)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return docToRecord(doc.id, doc.data());
}

export async function getPurchaseRecordById(id: string): Promise<PurchaseRecord | null> {
  const doc = await db.collection(PURCHASE_COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return docToRecord(doc.id, doc.data()!);
}

export async function markEmailVerified(recordId: string): Promise<void> {
  const ref = db.collection(PURCHASE_COLLECTION).doc(recordId);
  await ref.update({
    email_verified: true,
    verified_at: FieldValue.serverTimestamp(),
    verification_token: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function setVerificationToken(
  recordId: string,
  token: string
): Promise<void> {
  await db.collection(PURCHASE_COLLECTION).doc(recordId).update({
    verification_token: token,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function updatePurchaseRecordStripeSession(
  recordId: string,
  stripeSessionId: string
): Promise<void> {
  await db.collection(PURCHASE_COLLECTION).doc(recordId).update({
    stripe_session_id: stripeSessionId,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
